/**
 * Tests for database serialization functions.
 * These are pure functions that can be tested without mocking SQLite.
 */

import {
  serializeArray,
  serializeEmotions,
  parseTimestamp,
  toMoodEntry,
  normalizeInput,
  sanitizeImportedArray,
  sanitizeImportedEmotions,
  sanitizeEnergy,
} from "../../db/moods/serialization";
import type { Emotion, MoodEntryInput } from "../../db/types";

describe("serializeArray", () => {
  it("returns empty array string for undefined", () => {
    expect(serializeArray(undefined)).toBe("[]");
  });

  it("returns empty array string for empty array", () => {
    expect(serializeArray([])).toBe("[]");
  });

  it("serializes array of strings", () => {
    expect(serializeArray(["work", "home"])).toBe('["work","home"]');
  });

  it("limits to 50 items", () => {
    const items = Array.from({ length: 60 }, (_, i) => `item${i}`);
    const result = JSON.parse(serializeArray(items));
    expect(result).toHaveLength(50);
  });
});

describe("serializeEmotions", () => {
  it("returns empty array string for undefined", () => {
    expect(serializeEmotions(undefined)).toBe("[]");
  });

  it("returns empty array string for empty array", () => {
    expect(serializeEmotions([])).toBe("[]");
  });

  it("serializes emotions with categories", () => {
    const emotions: Emotion[] = [
      { name: "Happy", category: "positive" },
      { name: "Anxious", category: "negative" },
    ];
    const result = JSON.parse(serializeEmotions(emotions));
    expect(result).toEqual([
      { name: "Happy", category: "positive" },
      { name: "Anxious", category: "negative" },
    ]);
  });

  it("limits to 50 items", () => {
    const emotions: Emotion[] = Array.from({ length: 60 }, (_, i) => ({
      name: `emotion${i}`,
      category: "neutral" as const,
    }));
    const result = JSON.parse(serializeEmotions(emotions));
    expect(result).toHaveLength(50);
  });
});

describe("parseTimestamp", () => {
  it("returns current time for Date object", () => {
    const date = new Date("2024-01-15T12:00:00Z");
    expect(parseTimestamp(date)).toBe(date.getTime());
  });

  it("returns number directly if finite", () => {
    expect(parseTimestamp(1705320000000)).toBe(1705320000000);
  });

  it("returns current time for non-finite numbers", () => {
    const before = Date.now();
    const result = parseTimestamp(Infinity);
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  it("parses numeric string", () => {
    expect(parseTimestamp("1705320000000")).toBe(1705320000000);
  });

  it("parses ISO date string", () => {
    const isoString = "2024-01-15T12:00:00Z";
    expect(parseTimestamp(isoString)).toBe(Date.parse(isoString));
  });

  it("returns current time for invalid string", () => {
    const before = Date.now();
    const result = parseTimestamp("not a date");
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  it("returns current time for null", () => {
    const before = Date.now();
    const result = parseTimestamp(null);
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  it("returns current time for undefined", () => {
    const before = Date.now();
    const result = parseTimestamp(undefined);
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });
});

describe("toMoodEntry", () => {
  it("converts database row to MoodEntry", () => {
    const row = {
      id: 1,
      mood: 7,
      note: "Test note",
      timestamp: 1705320000000,
      emotions: '[{"name":"Happy","category":"positive"}]',
      context_tags: '["work"]',
      energy: 8,
      photos_json: null,
      location_json: null,
      voice_memos_json: null,
      based_on_entry_id: null,
    };

    const result = toMoodEntry(row);

    expect(result).toEqual({
      id: 1,
      mood: 7,
      note: "Test note",
      timestamp: 1705320000000,
      emotions: [{ name: "Happy", category: "positive" }],
      contextTags: ["work"],
      energy: 8,
      photos: [],
      location: null,
      voiceMemos: [],
      basedOnEntryId: null,
    });
  });

  it("handles null note", () => {
    const row = {
      id: 1,
      mood: 5,
      note: null,
      timestamp: 1705320000000,
      emotions: "[]",
      context_tags: "[]",
      energy: null,
      photos_json: null,
      location_json: null,
      voice_memos_json: null,
      based_on_entry_id: null,
    };

    const result = toMoodEntry(row);
    expect(result.note).toBeNull();
  });

  it("handles undefined note", () => {
    const row = {
      id: 1,
      mood: 5,
      note: undefined,
      timestamp: 1705320000000,
      emotions: "[]",
      context_tags: "[]",
      energy: null,
      photos_json: null,
      location_json: null,
      voice_memos_json: null,
      based_on_entry_id: null,
    };

    const result = toMoodEntry(row as any);
    expect(result.note).toBeNull();
  });

  it("handles null energy", () => {
    const row = {
      id: 1,
      mood: 5,
      note: null,
      timestamp: 1705320000000,
      emotions: "[]",
      context_tags: "[]",
      energy: null,
      photos_json: null,
      location_json: null,
      voice_memos_json: null,
      based_on_entry_id: null,
    };

    const result = toMoodEntry(row);
    expect(result.energy).toBeNull();
  });

  it("handles undefined energy", () => {
    const row = {
      id: 1,
      mood: 5,
      note: null,
      timestamp: 1705320000000,
      emotions: "[]",
      context_tags: "[]",
      energy: undefined,
      photos_json: null,
      location_json: null,
      voice_memos_json: null,
      based_on_entry_id: null,
    };

    const result = toMoodEntry(row as any);
    expect(result.energy).toBeNull();
  });

  it("parses legacy string-only emotions", () => {
    const row = {
      id: 1,
      mood: 5,
      note: null,
      timestamp: 1705320000000,
      emotions: '["Happy","Sad"]',
      context_tags: "[]",
      energy: null,
      photos_json: null,
      location_json: null,
      voice_memos_json: null,
      based_on_entry_id: null,
    };

    const result = toMoodEntry(row);
    expect(result.emotions).toEqual([
      { name: "Happy", category: "neutral" },
      { name: "Sad", category: "neutral" },
    ]);
  });

  it("handles empty emotions string", () => {
    const row = {
      id: 1,
      mood: 5,
      note: null,
      timestamp: 1705320000000,
      emotions: "",
      context_tags: "[]",
      energy: null,
      photos_json: null,
      location_json: null,
      voice_memos_json: null,
      based_on_entry_id: null,
    };

    const result = toMoodEntry(row);
    expect(result.emotions).toEqual([]);
  });

  it("handles malformed emotions JSON", () => {
    const row = {
      id: 1,
      mood: 5,
      note: null,
      timestamp: 1705320000000,
      emotions: "not valid json",
      context_tags: "[]",
      energy: null,
      photos_json: null,
      location_json: null,
      voice_memos_json: null,
      based_on_entry_id: null,
    };

    const result = toMoodEntry(row);
    expect(result.emotions).toEqual([]);
  });

  it("parses photos, location, and voice memos", () => {
    const row = {
      id: 1,
      mood: 7,
      note: null,
      timestamp: 1705320000000,
      emotions: "[]",
      context_tags: "[]",
      energy: null,
      photos_json: '["file://photo1.jpg","file://photo2.jpg"]',
      location_json: '{"latitude":40.7128,"longitude":-74.006,"name":"New York"}',
      voice_memos_json: '["file://memo1.m4a"]',
      based_on_entry_id: 5,
    };

    const result = toMoodEntry(row);
    expect(result.photos).toEqual(["file://photo1.jpg", "file://photo2.jpg"]);
    expect(result.location).toEqual({ latitude: 40.7128, longitude: -74.006, name: "New York" });
    expect(result.voiceMemos).toEqual(["file://memo1.m4a"]);
    expect(result.basedOnEntryId).toBe(5);
  });
});

describe("normalizeInput", () => {
  it("normalizes complete input", () => {
    const input: MoodEntryInput = {
      mood: 7,
      note: "Test note",
      timestamp: 1705320000000,
      emotions: [{ name: "Happy", category: "positive" }],
      contextTags: ["work"],
      energy: 8,
    };

    const result = normalizeInput(input);

    expect(result.note).toBe("Test note");
    expect(result.emotions).toEqual([{ name: "Happy", category: "positive" }]);
    expect(result.contextTags).toEqual(["work"]);
    expect(result.energy).toBe(8);
    expect(result.timestamp).toBe(1705320000000);
  });

  it("defaults note to null", () => {
    const input: MoodEntryInput = { mood: 5 };
    const result = normalizeInput(input);
    expect(result.note).toBeNull();
  });

  it("defaults emotions to empty array", () => {
    const input: MoodEntryInput = { mood: 5 };
    const result = normalizeInput(input);
    expect(result.emotions).toEqual([]);
  });

  it("defaults contextTags to empty array", () => {
    const input: MoodEntryInput = { mood: 5 };
    const result = normalizeInput(input);
    expect(result.contextTags).toEqual([]);
  });

  it("defaults energy to null", () => {
    const input: MoodEntryInput = { mood: 5 };
    const result = normalizeInput(input);
    expect(result.energy).toBeNull();
  });

  it("provides current timestamp if not specified", () => {
    const before = Date.now();
    const input: MoodEntryInput = { mood: 5 };
    const result = normalizeInput(input);
    const after = Date.now();

    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(after);
  });

  it("clamps energy to 0-10 range", () => {
    expect(normalizeInput({ mood: 5, energy: -5 }).energy).toBe(0);
    expect(normalizeInput({ mood: 5, energy: 15 }).energy).toBe(10);
  });

  it("rounds energy to integer", () => {
    expect(normalizeInput({ mood: 5, energy: 7.6 }).energy).toBe(8);
    expect(normalizeInput({ mood: 5, energy: 7.4 }).energy).toBe(7);
  });

  it("limits emotions to 50 items", () => {
    const emotions: Emotion[] = Array.from({ length: 60 }, (_, i) => ({
      name: `emotion${i}`,
      category: "neutral" as const,
    }));
    const result = normalizeInput({ mood: 5, emotions });
    expect(result.emotions).toHaveLength(50);
  });

  it("limits contextTags to 50 items", () => {
    const contextTags = Array.from({ length: 60 }, (_, i) => `tag${i}`);
    const result = normalizeInput({ mood: 5, contextTags });
    expect(result.contextTags).toHaveLength(50);
  });
});

describe("sanitizeImportedArray", () => {
  it("returns empty array for non-array", () => {
    expect(sanitizeImportedArray("not an array")).toEqual([]);
    expect(sanitizeImportedArray(123)).toEqual([]);
    expect(sanitizeImportedArray(null)).toEqual([]);
    expect(sanitizeImportedArray(undefined)).toEqual([]);
  });

  it("filters non-string items", () => {
    expect(sanitizeImportedArray(["valid", 123, null, "also valid"])).toEqual([
      "valid",
      "also valid",
    ]);
  });

  it("limits to 50 items", () => {
    const items = Array.from({ length: 60 }, (_, i) => `item${i}`);
    expect(sanitizeImportedArray(items)).toHaveLength(50);
  });
});

describe("sanitizeImportedEmotions", () => {
  it("returns empty array for non-array", () => {
    expect(sanitizeImportedEmotions("not an array")).toEqual([]);
    expect(sanitizeImportedEmotions(123)).toEqual([]);
    expect(sanitizeImportedEmotions(null)).toEqual([]);
    expect(sanitizeImportedEmotions(undefined)).toEqual([]);
  });

  it("converts string emotions to objects with neutral category", () => {
    expect(sanitizeImportedEmotions(["Happy", "Sad"])).toEqual([
      { name: "Happy", category: "neutral" },
      { name: "Sad", category: "neutral" },
    ]);
  });

  it("preserves emotion objects with valid categories", () => {
    const emotions = [
      { name: "Happy", category: "positive" },
      { name: "Anxious", category: "negative" },
    ];
    expect(sanitizeImportedEmotions(emotions)).toEqual(emotions);
  });

  it("trims emotion names", () => {
    expect(sanitizeImportedEmotions(["  Happy  "])).toEqual([
      { name: "Happy", category: "neutral" },
    ]);
  });

  it("filters empty names", () => {
    expect(sanitizeImportedEmotions(["", "  ", "Happy"])).toEqual([
      { name: "Happy", category: "neutral" },
    ]);
  });

  it("filters objects without valid category", () => {
    const emotions = [
      { name: "Happy", category: "invalid" },
      { name: "Sad", category: "negative" },
    ];
    expect(sanitizeImportedEmotions(emotions)).toEqual([
      { name: "Sad", category: "negative" },
    ]);
  });

  it("limits to 50 items", () => {
    const emotions = Array.from({ length: 60 }, (_, i) => `emotion${i}`);
    expect(sanitizeImportedEmotions(emotions)).toHaveLength(50);
  });
});

describe("sanitizeEnergy", () => {
  it("returns null for non-number", () => {
    expect(sanitizeEnergy("not a number")).toBeNull();
    expect(sanitizeEnergy(null)).toBeNull();
    expect(sanitizeEnergy(undefined)).toBeNull();
  });

  it("returns null for NaN", () => {
    expect(sanitizeEnergy(NaN)).toBeNull();
  });

  it("clamps to 0-10 range", () => {
    expect(sanitizeEnergy(-5)).toBe(0);
    expect(sanitizeEnergy(15)).toBe(10);
  });

  it("rounds to integer", () => {
    expect(sanitizeEnergy(7.6)).toBe(8);
    expect(sanitizeEnergy(7.4)).toBe(7);
  });

  it("returns valid energy value", () => {
    expect(sanitizeEnergy(5)).toBe(5);
    expect(sanitizeEnergy(0)).toBe(0);
    expect(sanitizeEnergy(10)).toBe(10);
  });
});
