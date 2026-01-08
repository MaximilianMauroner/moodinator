import type { MoodEntry } from "../types";
import { getDb } from "../client";
import { getMoodsWithinRange } from "./repository";
import { parseTimestamp, sanitizeEnergy, sanitizeImportedArray, serializeArray } from "./serialization";
import type { MoodDateRange } from "./range";

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
      const emotions = sanitizeImportedArray((mood as any)?.emotions);
      const contextSource =
        (mood as any)?.contextTags ?? (mood as any)?.context ?? [];
      const contextTags = sanitizeImportedArray(contextSource);
      const energy = sanitizeEnergy((mood as any)?.energy);
      await db.runAsync(
        "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy) VALUES (?, ?, ?, ?, ?, ?);",
        mood.mood,
        note,
        timestamp,
        serializeArray(emotions),
        serializeArray(contextTags),
        energy
      );
    }
    return moods.length;
  } catch (error) {
    console.error("Error importing moods:", error);
    throw new Error("Invalid mood data format");
  }
}

