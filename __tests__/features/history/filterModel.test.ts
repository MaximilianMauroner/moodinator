import { describe, expect, test } from "vitest";
import {
  EMPTY_MOOD_DRAFT,
  collapseChoices,
  datePresetRange,
  describeFilters,
  matchDatePreset,
  mergeFilterChoices,
  moodRangeSummary,
  pickMoodValue,
  removeFilter,
} from "@/features/history/filterModel";

const NOW = new Date(2026, 2, 20, 13, 45);

describe("date presets", () => {
  test("round trip through a stored range", () => {
    const range = datePresetRange("30d", NOW);
    expect(range).toEqual({
      startDate: new Date(2026, 1, 19).getTime(),
      endDate: new Date(2026, 2, 20, 23, 59, 59, 999).getTime(),
    });
    expect(matchDatePreset(range, NOW)).toBe("30d");
  });

  test("empty is any time and a hand-picked range is custom", () => {
    expect(matchDatePreset({}, NOW)).toBe("any");
    expect(
      matchDatePreset({ startDate: new Date(2025, 0, 5).getTime() }, NOW)
    ).toBe("custom");
  });
});

describe("mood range picking", () => {
  test("first tap selects one value, second completes the range", () => {
    const first = pickMoodValue(EMPTY_MOOD_DRAFT, 7);
    expect(first).toEqual({ range: { min: 7, max: 7 }, anchor: 7 });
    expect(pickMoodValue(first, 10).range).toEqual({ min: 7, max: 10 });
  });

  test("a lower second tap still reads low to high", () => {
    const anchored = pickMoodValue(EMPTY_MOOD_DRAFT, 8);
    expect(pickMoodValue(anchored, 3)).toEqual({
      range: { min: 3, max: 8 },
      anchor: null,
    });
  });

  test("tapping the only selected value clears it", () => {
    const settled = pickMoodValue(pickMoodValue(EMPTY_MOOD_DRAFT, 4), 4);
    expect(pickMoodValue(settled, 4)).toEqual(EMPTY_MOOD_DRAFT);
  });

  test("summaries name both ends of the inverted scale", () => {
    expect(moodRangeSummary(null)).toBe("Any mood");
    expect(moodRangeSummary({ min: 7, max: 10 })).toBe(
      "Mood 7–10 · Struggling to Emergency"
    );
  });
});

describe("active filter chips", () => {
  const filters = {
    ...datePresetRange("7d", NOW),
    minMood: 7,
    maxMood: 10,
    emotions: ["Calm, connected"],
    contexts: ["Work", "Friends"],
    text: "meeting",
  };

  test("describes every active filter once", () => {
    expect(describeFilters(filters, NOW)).toEqual([
      { id: "date", label: "Last 7 days" },
      { id: "mood", label: "Mood 7–10" },
      { id: "emotion:Calm, connected", label: "Calm, connected" },
      { id: "context:Work", label: "Work" },
      { id: "context:Friends", label: "Friends" },
      { id: "text", label: "“meeting”" },
    ]);
  });

  test("removing a chip drops only that filter", () => {
    expect(removeFilter(filters, "context:Work").contexts).toEqual(["Friends"]);
    expect(removeFilter(filters, "emotion:Calm, connected")).not.toHaveProperty(
      "emotions"
    );
    const withoutDates = removeFilter(filters, "date");
    expect(withoutDates.startDate).toBeUndefined();
    expect(withoutDates.endDate).toBeUndefined();
    expect(withoutDates.minMood).toBe(7);
  });

  test("legacy one-sided bounds read in plain words", () => {
    expect(describeFilters({ minMood: 7 }, NOW)[0].label).toBe("Mood 7 or worse");
    expect(describeFilters({ maxMood: 3 }, NOW)[0].label).toBe("Mood 3 or better");
  });
});

describe("collapsing long choice lists", () => {
  const many = Array.from({ length: 44 }, (_, index) => `E${index}`);

  test("holds back everything past the limit", () => {
    const { visible, hidden } = collapseChoices(many, [], false);
    expect(visible).toHaveLength(10);
    expect(hidden).toBe(34);
  });

  test("keeps selected names visible even when they sort late", () => {
    const { visible, hidden } = collapseChoices(many, ["E40", "E41"], false);
    expect(visible.slice(0, 2)).toEqual(["E40", "E41"]);
    expect(visible).toHaveLength(10);
    expect(hidden).toBe(34);
  });

  test("never hides a selection larger than the limit", () => {
    const selected = many.slice(0, 12);
    const { visible, hidden } = collapseChoices(many, selected, false);
    expect(visible).toHaveLength(12);
    expect(hidden).toBe(32);
  });

  test("expanded and short lists show everything", () => {
    expect(collapseChoices(many, [], true)).toEqual({ visible: many, hidden: 0 });
    expect(collapseChoices(["a", "b"], [], false)).toEqual({
      visible: ["a", "b"],
      hidden: 0,
    });
  });
});

test("choices merge presets, history names and the current selection", () => {
  expect(
    mergeFilterChoices(["Work", "Home"], ["Zoo", "Work", "Alps"], ["Retired tag"])
  ).toEqual(["Work", "Home", "Alps", "Zoo", "Retired tag"]);
});
