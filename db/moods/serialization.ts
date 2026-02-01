import type { Emotion, MoodEntry, MoodEntryInput, Location } from "../types";
import type { MoodRow, RawEmotionItem } from "../types/rows";

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

export function serializeLocation(value?: Location | null): string | null {
  if (!value) {
    return null;
  }
  return JSON.stringify(value);
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

function isValidLocation(value: unknown): value is Location {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).latitude === "number" &&
    typeof (value as Record<string, unknown>).longitude === "number"
  );
}

function deserializeLocation(value: unknown): Location | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    if (isValidLocation(parsed)) {
      return {
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        name: typeof parsed.name === "string" ? parsed.name : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
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
    photos: deserializeArray(row.photos_json),
    location: deserializeLocation(row.location_json),
    voiceMemos: deserializeArray(row.voice_memos_json),
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
    timestamp: entry.timestamp ?? Date.now(),
    photos: entry.photos ? entry.photos.slice(0, 10) : [],
    location: entry.location ?? null,
    voiceMemos: entry.voiceMemos ? entry.voiceMemos.slice(0, 5) : [],
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
