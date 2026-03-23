import type { Emotion, Location } from "../types";
import { getDb } from "../client";
import { getMoodsWithinRange } from "./repository";
import type { MoodDateRange } from "./range";
import {
  sanitizeEnergy,
  sanitizeImportedArray,
  sanitizeImportedEmotions,
  serializeArray,
  serializeEmotions,
  serializeLocation,
} from "./serialization";
import { linkEmotionsToMood } from "./emotions";
import { parseEmotionItem } from "./emotionUtils";
import { sanitizeMoodValue, sanitizeTimestamp } from "../validation";

function sanitizeImportedLocation(value: unknown): Location | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const location = value as Record<string, unknown>;
  const { latitude, longitude, name } = location;
  if (
    typeof latitude !== "number" ||
    Number.isNaN(latitude) ||
    typeof longitude !== "number" ||
    Number.isNaN(longitude)
  ) {
    return null;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return {
    latitude,
    longitude,
    name: typeof name === "string" && name.trim().length > 0 ? name.trim() : undefined,
  };
}

function sanitizeBasedOnEntryId(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

export async function exportMoods(range?: MoodDateRange): Promise<string> {
  const moods = await getMoodsWithinRange(range);
  return JSON.stringify(
    moods.map((entry) => ({
      timestamp: entry.timestamp,
      mood: entry.mood,
      emotions: entry.emotions,
      context: entry.contextTags,
      contextTags: entry.contextTags,
      energy: entry.energy,
      note: entry.note,
      notes: entry.note,
      photos: entry.photos,
      location: entry.location,
      voiceMemos: entry.voiceMemos,
      basedOnEntryId: entry.basedOnEntryId,
    }))
  );
}

export type ImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

export async function importMoods(jsonData: string): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonData);
  } catch {
    throw new Error("Invalid JSON format");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Import data must be an array");
  }

  const db = await getDb();
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  await db.execAsync("BEGIN TRANSACTION;");
  try {
    for (let i = 0; i < parsed.length; i++) {
      const rawMood = parsed[i] as Record<string, unknown>;

      // Validate mood value is present (required field)
      if (rawMood?.mood === undefined || rawMood?.mood === null) {
        result.skipped++;
        result.errors.push(`Entry ${i}: Missing mood value`);
        continue;
      }

      // Validate mood is in range
      const moodValue = sanitizeMoodValue(rawMood.mood);
      if (typeof rawMood.mood === "number" && (rawMood.mood < 0 || rawMood.mood > 10)) {
        result.skipped++;
        result.errors.push(`Entry ${i}: Mood value ${rawMood.mood} is out of range (0-10)`);
        continue;
      }

      // Normalize and sanitize other fields
      const note = (rawMood?.notes ?? rawMood?.note ?? null) as string | null;
      const timestamp = sanitizeTimestamp(rawMood?.timestamp);
      const emotions = sanitizeImportedEmotions(rawMood?.emotions);
      const contextSource = rawMood?.contextTags ?? rawMood?.context ?? [];
      const contextTags = sanitizeImportedArray(contextSource);
      const energy = sanitizeEnergy(rawMood?.energy);
      const photos = sanitizeImportedArray(rawMood?.photos);
      const location = sanitizeImportedLocation(rawMood?.location);
      const voiceMemos = sanitizeImportedArray(rawMood?.voiceMemos);
      const basedOnEntryId = sanitizeBasedOnEntryId(rawMood?.basedOnEntryId);

      const dbResult = await db.runAsync(
        "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy, photos_json, location_json, voice_memos_json, based_on_entry_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
        moodValue,
        note,
        timestamp,
        serializeEmotions(emotions),
        serializeArray(contextTags),
        energy,
        serializeArray(photos),
        serializeLocation(location),
        serializeArray(voiceMemos),
        basedOnEntryId
      );

      if (emotions.length > 0) {
        await linkEmotionsToMood(db, dbResult.lastInsertRowId, emotions);
      }

      result.imported++;
    }

    await db.execAsync("COMMIT;");
    return result;
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    console.error("Error importing moods:", error);
    throw new Error(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function importOldBackup(jsonData: string): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonData);
  } catch {
    throw new Error("Invalid JSON format in backup");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Backup data must be an array");
  }

  const db = await getDb();
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  await db.execAsync("BEGIN TRANSACTION;");
  try {
    for (let i = 0; i < parsed.length; i++) {
      const mood = parsed[i] as Record<string, unknown>;

      // Validate mood value is present
      if (mood?.mood === undefined || mood?.mood === null) {
        result.skipped++;
        result.errors.push(`Entry ${i}: Missing mood value`);
        continue;
      }

      const note = (mood?.notes ?? mood?.note ?? null) as string | null;
      const timestamp = sanitizeTimestamp(mood?.timestamp);
      const moodValue = sanitizeMoodValue(mood?.mood);

      let emotions: Emotion[] = [];
      if (mood?.emotions && Array.isArray(mood.emotions)) {
        emotions = mood.emotions
          .map(parseEmotionItem)
          .filter((e: Emotion | null): e is Emotion => e !== null);
      }

      const contextSource = mood?.contextTags ?? mood?.context ?? [];
      const contextTags = sanitizeImportedArray(contextSource);
      const energy = sanitizeEnergy(mood?.energy);
      const photos = sanitizeImportedArray(mood?.photos);
      const location = sanitizeImportedLocation(mood?.location);
      const voiceMemos = sanitizeImportedArray(mood?.voiceMemos);
      const basedOnEntryId = sanitizeBasedOnEntryId(mood?.basedOnEntryId);

      const dbResult = await db.runAsync(
        "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy, photos_json, location_json, voice_memos_json, based_on_entry_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
        moodValue,
        note,
        timestamp,
        serializeEmotions(emotions),
        serializeArray(contextTags),
        energy,
        serializeArray(photos),
        serializeLocation(location),
        serializeArray(voiceMemos),
        basedOnEntryId
      );

      if (emotions.length > 0) {
        await linkEmotionsToMood(db, dbResult.lastInsertRowId, emotions);
      }

      result.imported++;
    }

    await db.execAsync("COMMIT;");
    return result;
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    console.error("Error importing old backup:", error);
    throw new Error(`Backup import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
