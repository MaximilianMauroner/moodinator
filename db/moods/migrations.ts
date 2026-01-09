import { getDb } from "../client";
import type { Emotion } from "../types";
import { DEFAULT_EMOTIONS } from "../../src/lib/entrySettings";
import { serializeEmotions } from "./serialization";

export async function migrateEmotionsToCategories(): Promise<{
  migrated: number;
  skipped: number;
}> {
  const db = await getDb();
  let migrated = 0;
  let skipped = 0;

  await db.execAsync("BEGIN TRANSACTION;");
  try {
    const rows = await db.getAllAsync("SELECT id, emotions FROM moods;");

    for (const row of rows as any[]) {
      const rawEmotions = row.emotions;

      if (!rawEmotions || rawEmotions === "[]") {
        skipped++;
        continue;
      }

      try {
        const parsed = JSON.parse(rawEmotions);
        if (!Array.isArray(parsed)) {
          skipped++;
          continue;
        }

        const needsMigration = parsed.some((item: any) => {
          return (
            typeof item === "string" ||
            (typeof item === "object" && item && !item.category)
          );
        });

        if (!needsMigration) {
          skipped++;
          continue;
        }

        const migratedEmotions: Emotion[] = parsed.map((item: any): Emotion => {
          if (typeof item === "string") {
            const name = item;
            let category: "positive" | "negative" | "neutral" = "neutral";
            const defaultEmotion = DEFAULT_EMOTIONS.find((e) => e.name === name);
            if (defaultEmotion) {
              category = defaultEmotion.category;
            }
            return { name, category };
          }
          if (typeof item === "object" && item && item.name) {
            const category = item.category || "neutral";
            return { name: item.name, category };
          }
          return { name: String(item), category: "neutral" };
        });

        await db.runAsync(
          "UPDATE moods SET emotions = ? WHERE id = ?;",
          serializeEmotions(migratedEmotions),
          row.id
        );

        migrated++;
      } catch (error) {
        console.error(`Failed to migrate emotions for mood ${row.id}:`, error);
        skipped++;
      }
    }

    await db.execAsync("COMMIT;");
    console.log(
      `Emotion migration complete: ${migrated} migrated, ${skipped} skipped`
    );
    return { migrated, skipped };
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    console.error("Error during emotion migration:", error);
    throw error;
  }
}
