import type * as SQLite from "expo-sqlite";
import { getDb } from "../client";
import type { Emotion } from "../types";
import { DEFAULT_EMOTIONS } from "../../src/lib/entrySettings";
import { parseEmotionItem } from "./emotionUtils";

export async function createEmotionsTable() {
  const db = await getDb();
  await db.execAsync(`
        CREATE TABLE IF NOT EXISTS emotions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE COLLATE NOCASE,
            category TEXT NOT NULL CHECK(category IN ('positive', 'negative', 'neutral'))
        );
    `);
}

export async function createMoodEmotionsTable() {
  const db = await getDb();
  await db.execAsync(`
        CREATE TABLE IF NOT EXISTS mood_emotions (
            mood_id INTEGER NOT NULL,
            emotion_id INTEGER NOT NULL,
            PRIMARY KEY (mood_id, emotion_id),
            FOREIGN KEY (mood_id) REFERENCES moods(id) ON DELETE CASCADE,
            FOREIGN KEY (emotion_id) REFERENCES emotions(id) ON DELETE CASCADE
        );
    `);
}

export async function getAllEmotions(): Promise<Emotion[]> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    "SELECT name, category FROM emotions ORDER BY name ASC;"
  );
  return rows.map((row: any) => ({
    name: row.name,
    category: row.category as "positive" | "negative" | "neutral",
  }));
}

export async function addEmotion(emotion: Emotion): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync(
    "INSERT OR IGNORE INTO emotions (name, category) VALUES (?, ?);",
    emotion.name,
    emotion.category
  );

  if ((result as any).changes === 0) {
    throw new Error("An emotion with this name already exists");
  }
}

export async function updateEmotion(
  oldName: string,
  newEmotion: Emotion
): Promise<void> {
  const db = await getDb();

  if (oldName !== newEmotion.name) {
    const existing = await db.getFirstAsync(
      "SELECT id FROM emotions WHERE name = ?;",
      newEmotion.name
    );
    if (existing) {
      throw new Error("An emotion with this name already exists");
    }
  }

  await db.runAsync(
    "UPDATE emotions SET name = ?, category = ? WHERE name = ?;",
    newEmotion.name,
    newEmotion.category,
    oldName
  );
}

export async function deleteEmotion(name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM emotions WHERE name = ?;", name);
}

export async function upsertEmotionCategory(
  name: string,
  category: Emotion["category"]
): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync(
    "SELECT id FROM emotions WHERE name = ?;",
    name
  );

  if (existing) {
    await db.runAsync(
      "UPDATE emotions SET category = ? WHERE name = ?;",
      category,
      name
    );
    return;
  }

  await db.runAsync(
    "INSERT INTO emotions (name, category) VALUES (?, ?);",
    name,
    category
  );
}

async function getOrCreateEmotionId(
  db: SQLite.SQLiteDatabase,
  emotion: Emotion
): Promise<number> {
  await db.runAsync(
    "INSERT OR REPLACE INTO emotions (name, category) VALUES (?, ?);",
    emotion.name,
    emotion.category
  );

  const row = await db.getFirstAsync(
    "SELECT id FROM emotions WHERE name = ?;",
    emotion.name
  );

  return (row as any).id;
}

export async function linkEmotionsToMood(
  db: SQLite.SQLiteDatabase,
  moodId: number,
  emotions: Emotion[]
): Promise<void> {
  await db.runAsync("DELETE FROM mood_emotions WHERE mood_id = ?;", moodId);

  for (const emotion of emotions) {
    const emotionId = await getOrCreateEmotionId(db, emotion);
    await db.runAsync(
      "INSERT OR IGNORE INTO mood_emotions (mood_id, emotion_id) VALUES (?, ?);",
      moodId,
      emotionId
    );
  }
}

export async function migrateEmotionsToTable(): Promise<{ migrated: number }> {
  const db = await getDb();
  let migrated = 0;
  const emotionIds = new Map<string, number>();

  await db.execAsync("BEGIN TRANSACTION;");
  try {
    const rows = await db.getAllAsync("SELECT id, emotions FROM moods;");

    for (const row of rows as any[]) {
      const rawEmotions = row.emotions;
      if (!rawEmotions || rawEmotions === "[]") {
        continue;
      }

      try {
        const parsed = JSON.parse(rawEmotions);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          continue;
        }

        const emotions: Emotion[] = parsed
          .map(parseEmotionItem)
          .filter((e): e is Emotion => e !== null);

        for (const emotion of emotions) {
          let emotionId: number;
          if (emotionIds.has(emotion.name)) {
            emotionId = emotionIds.get(emotion.name)!;
          } else {
            emotionId = await getOrCreateEmotionId(db, emotion);
            emotionIds.set(emotion.name, emotionId);
          }

          await db.runAsync(
            "INSERT OR IGNORE INTO mood_emotions (mood_id, emotion_id) VALUES (?, ?);",
            row.id,
            emotionId
          );
        }

        migrated++;
      } catch (error) {
        console.error(
          `Failed to migrate emotions for mood ${row.id}:`,
          error
        );
      }
    }

    await db.execAsync("COMMIT;");
    console.log(
      `Emotion migration complete: ${migrated} moods migrated, ${emotionIds.size} unique emotions in table`
    );
    return { migrated };
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    console.error("Error during emotion table migration:", error);
    throw error;
  }
}

export async function hasEmotionTableMigrated(): Promise<boolean> {
  const db = await getDb();
  const emotionCount = await db.getFirstAsync(
    "SELECT COUNT(*) as count FROM emotions;"
  );
  const hasEmotions = (emotionCount as any)?.count > 0;

  const linkCount = await db.getFirstAsync(
    "SELECT COUNT(*) as count FROM mood_emotions;"
  );
  const hasLinks = (linkCount as any)?.count > 0;

  return hasEmotions || hasLinks;
}

export async function ensureDefaultEmotions(): Promise<void> {
  const db = await getDb();

  if (!DEFAULT_EMOTIONS.length) {
    return;
  }

  const placeholders = DEFAULT_EMOTIONS.map(() => "(?, ?)").join(", ");
  const values: string[] = [];

  for (const emotion of DEFAULT_EMOTIONS) {
    values.push(emotion.name, emotion.category);
  }

  await db.runAsync(
    `INSERT OR IGNORE INTO emotions (name, category) VALUES ${placeholders};`,
    ...values
  );
}
