import type { MoodEntry, MoodEntryInput } from "../types";

export function serializeArray(value?: string[]): string {
  if (!value || value.length === 0) {
    return "[]";
  }
  return JSON.stringify(value.slice(0, 50));
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

export function toMoodEntry(row: any): MoodEntry {
  return {
    id: row.id,
    mood: row.mood,
    note: row.note ?? null,
    timestamp: parseTimestamp(row.timestamp),
    emotions: deserializeArray(row.emotions),
    contextTags: deserializeArray(row.context_tags),
    energy:
      row.energy === null || row.energy === undefined
        ? null
        : Number(row.energy),
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

export function sanitizeEnergy(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return Math.min(10, Math.max(0, Math.round(value)));
}

