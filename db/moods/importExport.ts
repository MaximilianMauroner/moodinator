import type { MoodEntry } from "../types";
import { getDb } from "../client";
import { getMoodsWithinRange } from "./repository";
import type { MoodDateRange } from "./range";
import {
  parseTimestamp,
  sanitizeEnergy,
  sanitizeImportedArray,
  sanitizeImportedEmotions,
  serializeArray,
  serializeEmotions,
} from "./serialization";
import { linkEmotionsToMood } from "./emotions";
import { parseEmotionItem } from "./emotionUtils";
import type { Emotion } from "../types";

export async function exportMoods(range?: MoodDateRange): Promise<string> {
  const moods = await getMoodsWithinRange(range);
  return JSON.stringify(
    moods.map((entry) => ({
      timestamp: entry.timestamp,
      mood: entry.mood,
      emotions: entry.emotions,
      context: entry.contextTags,
      energy: entry.energy,
      notes: entry.note,
    }))
  );
}

export async function importMoods(jsonData: string): Promise<number> {
  try {
    const moods = JSON.parse(jsonData) as MoodEntry[];
    const db = await getDb();

    for (const mood of moods) {
      const note = (mood as any)?.notes ?? (mood as any)?.note ?? null;
      const timestamp = parseTimestamp((mood as any)?.timestamp);
      const emotions = sanitizeImportedEmotions((mood as any)?.emotions);
      const contextSource =
        (mood as any)?.contextTags ?? (mood as any)?.context ?? [];
      const contextTags = sanitizeImportedArray(contextSource);
      const energy = sanitizeEnergy((mood as any)?.energy);
      const result = await db.runAsync(
        "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy) VALUES (?, ?, ?, ?, ?, ?);",
        mood.mood,
        note,
        timestamp,
        serializeEmotions(emotions),
        serializeArray(contextTags),
        energy
      );

      if (emotions.length > 0) {
        await linkEmotionsToMood(db, result.lastInsertRowId, emotions);
      }
    }
    return moods.length;
  } catch (error) {
    console.error("Error importing moods:", error);
    throw new Error("Invalid mood data format");
  }
}

export async function importOldBackup(jsonData: string): Promise<number> {
  const db = await getDb();

  await db.execAsync("BEGIN TRANSACTION;");
  try {
    const moods = JSON.parse(jsonData) as any[];

    for (const mood of moods) {
      const note = mood?.notes ?? mood?.note ?? null;
      const timestamp = parseTimestamp(mood?.timestamp);

      let emotions: Emotion[] = [];
      if (mood?.emotions && Array.isArray(mood.emotions)) {
        emotions = mood.emotions
          .map(parseEmotionItem)
          .filter((e): e is Emotion => e !== null);
      }

      const contextSource = mood?.contextTags ?? mood?.context ?? [];
      const contextTags = sanitizeImportedArray(contextSource);
      const energy = sanitizeEnergy(mood?.energy);

      const result = await db.runAsync(
        "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy) VALUES (?, ?, ?, ?, ?, ?);",
        mood.mood,
        note,
        timestamp,
        serializeEmotions(emotions),
        serializeArray(contextTags),
        energy
      );

      if (emotions.length > 0) {
        await linkEmotionsToMood(db, result.lastInsertRowId, emotions);
      }
    }

    await db.execAsync("COMMIT;");
    return moods.length;
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    console.error("Error importing old backup:", error);
    throw new Error("Invalid backup data format");
  }
}
