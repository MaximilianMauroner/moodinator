import type { Emotion } from "../types";
import { getDb } from "../client";
import { getMoodsWithinRange } from "./repository";
import type { MoodDateRange } from "./range";
import {
  sanitizeEnergy,
  sanitizeImportedArray,
  sanitizeImportedEmotions,
  sanitizeImportedMoodScale,
  serializeArray,
  serializeEmotions,
  serializeMoodScale,
} from "./serialization";
import { linkEmotionsToMood } from "./emotions";
import { parseEmotionItem } from "./emotionUtils";
import { sanitizeMoodValue, sanitizeTimestamp } from "../validation";

function sanitizeBasedOnEntryId(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

type NormalizedImportedMood = {
  mood: number;
  note: string | null;
  timestamp: number;
  emotions: Emotion[];
  contextTags: string[];
  energy: number | null;
  moodScale: ReturnType<typeof sanitizeImportedMoodScale>;
  basedOnEntryId: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateImportedMoodValue(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 10
  ) {
    return null;
  }

  return value;
}

function normalizeReplacementImportEntries(parsed: unknown[]): {
  entries: NormalizedImportedMood[];
  errors: string[];
} {
  const entries: NormalizedImportedMood[] = [];
  const errors: string[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const rawMood = parsed[i];
    if (!isRecord(rawMood)) {
      errors.push(`Entry ${i}: Entry must be an object`);
      continue;
    }

    if (rawMood.mood === undefined || rawMood.mood === null) {
      errors.push(`Entry ${i}: Missing mood value`);
      continue;
    }

    const moodValue = validateImportedMoodValue(rawMood.mood);
    if (moodValue === null) {
      errors.push(`Entry ${i}: Mood value must be an integer between 0 and 10`);
      continue;
    }

    const note = (rawMood.notes ?? rawMood.note ?? null) as string | null;
    const contextSource = rawMood.contextTags ?? rawMood.context ?? [];

    entries.push({
      mood: moodValue,
      note,
      timestamp: sanitizeTimestamp(rawMood.timestamp),
      emotions: sanitizeImportedEmotions(rawMood.emotions),
      contextTags: sanitizeImportedArray(contextSource),
      energy: sanitizeEnergy(rawMood.energy),
      moodScale: sanitizeImportedMoodScale(rawMood.moodScale),
      basedOnEntryId: sanitizeBasedOnEntryId(rawMood.basedOnEntryId),
    });
  }

  return { entries, errors };
}

async function clearImportedMoodData(db: Awaited<ReturnType<typeof getDb>>) {
  await db.runAsync("DELETE FROM mood_emotions;");
  await db.runAsync("DELETE FROM moods;");
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
      moodScale: entry.moodScale,
      basedOnEntryId: entry.basedOnEntryId,
    }))
  );
}

export type ImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

export type ImportPreviewResult = {
  entryCount: number;
};

function normalizeReplacementImportData(jsonData: string): NormalizedImportedMood[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonData);
  } catch {
    throw new Error("Invalid JSON format");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Import data must be an array");
  }

  const normalized = normalizeReplacementImportEntries(parsed);
  if (normalized.errors.length > 0) {
    throw new Error(
      `Import contains invalid entries: ${normalized.errors.slice(0, 5).join("; ")}`
    );
  }

  return normalized.entries;
}

export function previewImportMoods(jsonData: string): ImportPreviewResult {
  return {
    entryCount: normalizeReplacementImportData(jsonData).length,
  };
}

export async function importMoods(jsonData: string): Promise<ImportResult> {
  const entries = normalizeReplacementImportData(jsonData);

  const db = await getDb();
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  await db.execAsync("BEGIN TRANSACTION;");
  try {
    await clearImportedMoodData(db);

    for (const entry of entries) {
      const dbResult = await db.runAsync(
        "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy, mood_scale_json, photos_json, location_json, voice_memos_json, based_on_entry_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
        entry.mood,
        entry.note,
        entry.timestamp,
        serializeEmotions(entry.emotions),
        serializeArray(entry.contextTags),
        entry.energy,
        serializeMoodScale(entry.moodScale),
        "[]",
        null,
        "[]",
        entry.basedOnEntryId
      );

      if (entry.emotions.length > 0) {
        await linkEmotionsToMood(db, dbResult.lastInsertRowId, entry.emotions);
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
      const basedOnEntryId = sanitizeBasedOnEntryId(mood?.basedOnEntryId);
      // Legacy backups did not carry moodScale; assume the current local scale.
      const moodScale = sanitizeImportedMoodScale(mood?.moodScale);

      const dbResult = await db.runAsync(
        "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy, mood_scale_json, photos_json, location_json, voice_memos_json, based_on_entry_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
        moodValue,
        note,
        timestamp,
        serializeEmotions(emotions),
        serializeArray(contextTags),
        energy,
        serializeMoodScale(moodScale),
        "[]",
        null,
        "[]",
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
