import { describe, expect, test } from "vitest";
import {
  DEFAULT_CONTEXTS,
  DEFAULT_EMOTIONS,
  DEFAULT_THERAPY_EXPORT_PREFS,
  parseEmotionList,
  parseStringList,
  sanitizeTherapyFields,
} from "../../src/lib/entrySettings";

describe("parseEmotionList", () => {
  test("returns defaults for non-array input", () => {
    expect(parseEmotionList(null)).toBe(DEFAULT_EMOTIONS);
  });

  test("preserves an explicit empty array", () => {
    expect(parseEmotionList([])).toEqual([]);
  });

  test("parses legacy string arrays and resolves categories from defaults", () => {
    expect(parseEmotionList(["Happy", "mystery"])).toEqual([
      { name: "Happy", category: "positive" },
      { name: "mystery", category: "neutral" },
    ]);
  });

  test("parses object arrays, preserving valid categories and repairing invalid ones", () => {
    expect(
      parseEmotionList([
        { name: "  Lonely  ", category: "negative" },
        { name: "Relaxed", category: "invalid" },
        { name: "Custom", category: "wrong" },
        { name: "   " },
        42,
      ])
    ).toEqual([
      { name: "Lonely", category: "negative" },
      { name: "Relaxed", category: "positive" },
      { name: "Custom", category: "neutral" },
    ]);
  });
});

describe("parseStringList", () => {
  test("returns fallback for non-array or fully invalid input", () => {
    expect(parseStringList(null, DEFAULT_CONTEXTS)).toBe(DEFAULT_CONTEXTS);
    expect(parseStringList([null, "", "   "], DEFAULT_CONTEXTS)).toBe(
      DEFAULT_CONTEXTS
    );
  });

  test("preserves an explicit empty array", () => {
    expect(parseStringList([], DEFAULT_CONTEXTS)).toEqual([]);
  });

  test("keeps only non-empty strings", () => {
    expect(parseStringList(["Home", "", "Work", 3, "  Outside  "], [])).toEqual(
      ["Home", "Work", "  Outside  "]
    );
  });
});

describe("sanitizeTherapyFields", () => {
  test("returns defaults for non-array or empty valid results", () => {
    expect(sanitizeTherapyFields(null)).toBe(
      DEFAULT_THERAPY_EXPORT_PREFS.fields
    );
    expect(sanitizeTherapyFields(["invalid", 1])).toBe(
      DEFAULT_THERAPY_EXPORT_PREFS.fields
    );
  });

  test("filters out unknown values and preserves valid ones", () => {
    expect(
      sanitizeTherapyFields(["timestamp", "notes", "bad-field", "mood"])
    ).toEqual(["timestamp", "notes", "mood"]);
  });
});
