import type { Emotion, MoodEntry, MoodEntryInput, MoodScaleSnapshot } from "../types";
import type { MoodRow, RawEmotionItem } from "../types/rows";
import {
  CURRENT_MOOD_SCALE_SNAPSHOT,
  getSupportedMoodScaleSnapshot,
} from "../../domain/moodScale";

export { CURRENT_MOOD_SCALE_SNAPSHOT } from "../../domain/moodScale";

export function serializeArray(value?: string[]): string {
  if (!value || value.length === 0) {
    return "[]";
  }
  return JSON.stringify(value.slice(0, 50));
}

export function serializeEmotions(value?: Emotion[]): string {
  if (!value || value.length === 0) {
    return "[]";
  }
  return JSON.stringify(value.slice(0, 50));
}

export function serializeMoodScale(value?: MoodScaleSnapshot): string {
  return JSON.stringify(value ?? CURRENT_MOOD_SCALE_SNAPSHOT);
}

export function isValidMoodScaleSnapshot(value: unknown): value is MoodScaleSnapshot {
  return getSupportedMoodScaleSnapshot(value) !== null;
}

function deserializeArray(value: unknown): string[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((v) => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

function isValidEmotionObject(
  item: unknown
): item is { name: string; category: "positive" | "negative" | "neutral" } {
  return (
    typeof item === "object" &&
    item !== null &&
    typeof (item as Record<string, unknown>).name === "string" &&
    ((item as Record<string, unknown>).name as string).trim().length > 0 &&
    ((item as Record<string, unknown>).category === "positive" ||
      (item as Record<string, unknown>).category === "negative" ||
      (item as Record<string, unknown>).category === "neutral")
  );
}

function deserializeEmotions(value: unknown): Emotion[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as RawEmotionItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item): Emotion | null => {
        if (typeof item === "string" && item.trim().length > 0) {
          return { name: item.trim(), category: "neutral" };
        }
        if (isValidEmotionObject(item)) {
          return {
            name: item.name.trim(),
            category: item.category,
          };
        }
        return null;
      })
      .filter((item): item is Emotion => item !== null);
  } catch {
    return [];
  }
}

function deserializeMoodScale(value: unknown): MoodScaleSnapshot {
  if (typeof value !== "string" || value.length === 0) {
    return CURRENT_MOOD_SCALE_SNAPSHOT;
  }
  try {
    const parsed = JSON.parse(value);
    const snapshot = getSupportedMoodScaleSnapshot(parsed);
    if (snapshot) {
      return snapshot;
    }
  } catch {
    // Fall back below.
  }
  return CURRENT_MOOD_SCALE_SNAPSHOT;
}

export function parseTimestamp(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return Date.now();
}

export function toMoodEntry(row: MoodRow): MoodEntry {
  return {
    id: row.id,
    mood: row.mood,
    note: row.note ?? null,
    timestamp: parseTimestamp(row.timestamp),
    emotions: deserializeEmotions(row.emotions),
    contextTags: deserializeArray(row.context_tags),
    energy:
      row.energy === null || row.energy === undefined
        ? null
        : Number(row.energy),
    moodScale: deserializeMoodScale(row.mood_scale_json),
    basedOnEntryId: row.based_on_entry_id ?? null,
  };
}

export function normalizeInput(entry: MoodEntryInput) {
  return {
    note: entry.note ?? null,
    emotions: entry.emotions ? entry.emotions.slice(0, 50) : [],
    contextTags: entry.contextTags ? entry.contextTags.slice(0, 50) : [],
    energy:
      entry.energy === null || entry.energy === undefined
        ? null
        : Math.min(10, Math.max(0, Math.round(entry.energy))),
    moodScale: entry.moodScale ?? CURRENT_MOOD_SCALE_SNAPSHOT,
    timestamp: entry.timestamp ?? Date.now(),
    basedOnEntryId: entry.basedOnEntryId ?? null,
  };
}

export function sanitizeImportedArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .slice(0, 50);
}

export function sanitizeImportedEmotions(value: unknown): Emotion[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return (value as RawEmotionItem[])
    .map((item): Emotion | null => {
      if (typeof item === "string" && item.trim().length > 0) {
        return { name: item.trim(), category: "neutral" };
      }
      if (isValidEmotionObject(item)) {
        return {
          name: item.name.trim(),
          category: item.category,
        };
      }
      return null;
    })
    .filter((item): item is Emotion => item !== null)
    .slice(0, 50);
}

export function sanitizeEnergy(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return Math.min(10, Math.max(0, Math.round(value)));
}

export function sanitizeImportedMoodScale(value: unknown): MoodScaleSnapshot {
  return getSupportedMoodScaleSnapshot(value) ?? CURRENT_MOOD_SCALE_SNAPSHOT;
}
