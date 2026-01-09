import type { Emotion, MoodEntry, MoodEntryInput } from "../types";
import { getDb } from "../client";
import { resolveDateRange, type MoodDateRange } from "./range";
import {
  normalizeInput,
  serializeArray,
  serializeEmotions,
  toMoodEntry,
} from "./serialization";
import { linkEmotionsToMood } from "./emotions";

export async function insertMood(
  mood: number,
  note?: string,
  metadata?: Omit<MoodEntryInput, "mood" | "note">
): Promise<MoodEntry> {
  const db = await getDb();
  const normalized = normalizeInput({
    mood,
    note: note ?? null,
    ...metadata,
  });

  await db.execAsync("BEGIN TRANSACTION;");
  try {
    const result = await db.runAsync(
      "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy) VALUES (?, ?, ?, ?, ?, ?);",
      mood,
      normalized.note,
      normalized.timestamp,
      serializeEmotions(normalized.emotions),
      serializeArray(normalized.contextTags),
      normalized.energy
    );

    if (normalized.emotions && normalized.emotions.length > 0) {
      await linkEmotionsToMood(db, result.lastInsertRowId, normalized.emotions);
    }

    await db.execAsync("COMMIT;");

    const inserted = await db.getFirstAsync(
      "SELECT * FROM moods WHERE id = ?;",
      result.lastInsertRowId
    );
    return toMoodEntry(inserted);
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }
}

export async function insertMoodEntry(entry: MoodEntryInput): Promise<MoodEntry> {
  const db = await getDb();
  const normalized = normalizeInput(entry);

  await db.execAsync("BEGIN TRANSACTION;");
  try {
    const result = await db.runAsync(
      "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy) VALUES (?, ?, ?, ?, ?, ?);",
      entry.mood,
      normalized.note,
      normalized.timestamp,
      serializeEmotions(normalized.emotions),
      serializeArray(normalized.contextTags),
      normalized.energy
    );

    if (normalized.emotions && normalized.emotions.length > 0) {
      await linkEmotionsToMood(db, result.lastInsertRowId, normalized.emotions);
    }

    await db.execAsync("COMMIT;");

    const inserted = await db.getFirstAsync(
      "SELECT * FROM moods WHERE id = ?;",
      result.lastInsertRowId
    );
    return toMoodEntry(inserted);
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }
}

export async function hasMoodBeenLoggedToday(): Promise<boolean> {
  const db = await getDb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const result = await db.getFirstAsync(
    "SELECT COUNT(*) as count FROM moods WHERE timestamp >= ? AND timestamp <= ?;",
    todayStart.getTime(),
    todayEnd.getTime()
  );

  return (result as any).count > 0;
}

export async function updateMoodNote(
  id: number,
  note: string
): Promise<MoodEntry | undefined> {
  const db = await getDb();
  await db.runAsync("UPDATE moods SET note = ? WHERE id = ?;", note, id);
  const updated = await db.getFirstAsync(
    "SELECT * FROM moods WHERE id = ?;",
    id
  );
  return updated ? toMoodEntry(updated) : undefined;
}

export async function updateMoodTimestamp(
  id: number,
  timestamp: number
): Promise<MoodEntry | undefined> {
  const db = await getDb();
  await db.runAsync("UPDATE moods SET timestamp = ? WHERE id = ?;", timestamp, id);
  const updated = await db.getFirstAsync(
    "SELECT * FROM moods WHERE id = ?;",
    id
  );
  return updated ? toMoodEntry(updated) : undefined;
}

export async function updateMoodEntry(
  id: number,
  updates: Partial<MoodEntryInput & { mood: number }>
): Promise<MoodEntry | undefined> {
  const db = await getDb();
  const fields: string[] = [];
  const params: any[] = [];
  let updateEmotions = false;
  let emotionsToUpdate: Emotion[] = [];

  if (typeof updates.mood === "number") {
    fields.push("mood = ?");
    params.push(updates.mood);
  }
  if (updates.note !== undefined) {
    fields.push("note = ?");
    params.push(updates.note);
  }
  if (updates.timestamp !== undefined) {
    fields.push("timestamp = ?");
    params.push(updates.timestamp);
  }
  if (updates.emotions !== undefined) {
    fields.push("emotions = ?");
    params.push(serializeEmotions(updates.emotions));
    updateEmotions = true;
    emotionsToUpdate = updates.emotions;
  }
  if (updates.contextTags !== undefined) {
    fields.push("context_tags = ?");
    params.push(serializeArray(updates.contextTags));
  }
  if (updates.energy !== undefined) {
    fields.push("energy = ?");
    params.push(
      updates.energy === null
        ? null
        : Math.min(10, Math.max(0, Math.round(updates.energy)))
    );
  }

  if (!fields.length) {
    const current = await db.getFirstAsync("SELECT * FROM moods WHERE id = ?;", id);
    return current ? toMoodEntry(current) : undefined;
  }

  await db.execAsync("BEGIN TRANSACTION;");
  try {
    await db.runAsync(
      `UPDATE moods SET ${fields.join(", ")} WHERE id = ?;`,
      ...params,
      id
    );

    if (updateEmotions) {
      await linkEmotionsToMood(db, id, emotionsToUpdate);
    }

    await db.execAsync("COMMIT;");
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }

  const updated = await db.getFirstAsync(
    "SELECT * FROM moods WHERE id = ?;",
    id
  );
  return updated ? toMoodEntry(updated) : undefined;
}

export async function getAllMoods(): Promise<MoodEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync("SELECT * FROM moods ORDER BY timestamp DESC;");
  return rows.map(toMoodEntry);
}

export async function deleteMood(id: number) {
  const db = await getDb();
  return await db.runAsync("DELETE FROM moods WHERE id = ?;", id);
}

export async function getMoodCount(): Promise<number> {
  const db = await getDb();
  const result = await db.getFirstAsync("SELECT COUNT(*) as count FROM moods");
  const count = (result as any)?.count || 0;
  return count;
}

export async function getMoodsWithinRange(
  range?: MoodDateRange
): Promise<MoodEntry[]> {
  const db = await getDb();
  const { startDate, endDate } = resolveDateRange(range);
  const conditions: string[] = [];
  const params: any[] = [];

  if (typeof startDate === "number") {
    conditions.push("timestamp >= ?");
    params.push(startDate);
  }
  if (typeof endDate === "number") {
    conditions.push("timestamp <= ?");
    params.push(endDate);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await db.getAllAsync(
    `SELECT * FROM moods ${whereClause} ORDER BY timestamp DESC;`,
    ...params
  );
  return rows.map(toMoodEntry);
}
