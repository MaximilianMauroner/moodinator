import { describe, test, expect } from "vitest";
import {
  processMoodDataForDailyChart,
  processWeeklyMoodData,
  sampleDataPoints,
  getDaysInRange,
} from "../../src/lib/moodChartData";
import type { MoodEntry } from "../../db/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultScale = {
  version: 1 as const,
  min: 0 as const,
  max: 10 as const,
  lowerIsBetter: true as const,
};

let nextId = 1;

function mood(value: number, isoDate: string, hour = 12): MoodEntry {
  return {
    id: nextId++,
    mood: value,
    note: null,
    timestamp: new Date(`${isoDate}T${String(hour).padStart(2, "0")}:00:00Z`).getTime(),
    emotions: [],
    contextTags: [],
    energy: null,
    moodScale: defaultScale,
    photos: [],
    location: null,
    voiceMemos: [],
    basedOnEntryId: null,
  };
}

// ---------------------------------------------------------------------------
// getDaysInRange
// ---------------------------------------------------------------------------

describe("getDaysInRange", () => {
  // Tracer bullet
  test("returns a single day when start equals end", () => {
    const d = new Date("2024-01-15T12:00:00Z");
    const days = getDaysInRange(d, d);
    expect(days).toHaveLength(1);
  });

  test("includes every day between start and end inclusive", () => {
    const start = new Date("2024-01-01T12:00:00Z");
    const end = new Date("2024-01-05T12:00:00Z");
    const days = getDaysInRange(start, end);
    expect(days).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// sampleDataPoints
// ---------------------------------------------------------------------------

describe("sampleDataPoints", () => {
  // Tracer bullet
  test("returns data unchanged when count is within the limit", () => {
    const data = [{ timestamp: 1000 }, { timestamp: 2000 }, { timestamp: 3000 }];
    expect(sampleDataPoints(data, 10)).toEqual(data);
  });

  test("returns exactly maxPoints items when count exceeds the limit", () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ timestamp: i * 1000 }));
    const sampled = sampleDataPoints(data, 10);
    expect(sampled).toHaveLength(10);
  });

  test("always preserves the first and last data points", () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ timestamp: i * 1000 }));
    const sampled = sampleDataPoints(data, 10);
    expect(sampled[0].timestamp).toBe(0);
    expect(sampled[sampled.length - 1].timestamp).toBe(99_000);
  });
});

// ---------------------------------------------------------------------------
// processMoodDataForDailyChart
// ---------------------------------------------------------------------------

describe("processMoodDataForDailyChart", () => {
  // Tracer bullet
  test("returns empty labels and aggregates for no moods", () => {
    const result = processMoodDataForDailyChart([]);
    expect(result.labels).toEqual([]);
    expect(result.dailyAggregates).toEqual([]);
  });

  test("returns one aggregate with hasRealData true for a single mood entry", () => {
    const { dailyAggregates } = processMoodDataForDailyChart([mood(3, "2024-01-15")]);
    expect(dailyAggregates).toHaveLength(1);
    expect(dailyAggregates[0].hasRealData).toBe(true);
    expect(dailyAggregates[0].isInterpolated).toBe(false);
    expect(dailyAggregates[0].finalAvg).toBe(3);
  });

  test("averages multiple Mood Entries on the same day", () => {
    const moods = [
      mood(2, "2024-01-15"),
      mood(6, "2024-01-15"),
    ];
    const { dailyAggregates } = processMoodDataForDailyChart(moods);
    expect(dailyAggregates).toHaveLength(1);
    expect(dailyAggregates[0].finalAvg).toBe(4);
    expect(dailyAggregates[0].moods).toEqual([2, 6]);
  });

  test("linearly interpolates a gap day between two real days", () => {
    // Jan 1: mood 2, Jan 3: mood 6 → Jan 2 should interpolate to 4
    const moods = [mood(2, "2024-01-01"), mood(6, "2024-01-03")];
    const { dailyAggregates } = processMoodDataForDailyChart(moods);

    expect(dailyAggregates).toHaveLength(3);

    const gapDay = dailyAggregates[1];
    expect(gapDay.hasRealData).toBe(false);
    expect(gapDay.isInterpolated).toBe(true);
    expect(gapDay.finalAvg).toBeCloseTo(4, 5);
  });

  test("excludes Mood Entries older than the numDays window", () => {
    const moods = [
      mood(8, "2024-01-01"), // 9 days before most recent
      mood(3, "2024-01-10"),
    ];
    // With numDays=5 the cutoff is Jan 6, so Jan 1 is excluded
    const { dailyAggregates } = processMoodDataForDailyChart(moods, 5);
    expect(dailyAggregates).toHaveLength(1);
    expect(dailyAggregates[0].finalAvg).toBe(3);
  });

  test("labels each aggregate with the day-of-month string", () => {
    const moods = [mood(5, "2024-01-07"), mood(5, "2024-01-09")];
    const { labels } = processMoodDataForDailyChart(moods);
    // Jan 7, gap Jan 8, Jan 9
    expect(labels).toEqual(["7", "8", "9"]);
  });
});

// ---------------------------------------------------------------------------
// processWeeklyMoodData
// ---------------------------------------------------------------------------

describe("processWeeklyMoodData", () => {
  // Use a fixed reference date so the maxWeeks cutoff is deterministic
  const REF = new Date("2024-02-01T12:00:00Z"); // reference "today" for all weekly tests

  // Tracer bullet
  test("returns empty labels and aggregates for no moods", () => {
    const result = processWeeklyMoodData([], 52, REF);
    expect(result.labels).toEqual([]);
    expect(result.weeklyAggregates).toEqual([]);
  });

  test("uses the median as finalAvg, not the mean", () => {
    // [1, 1, 9]: mean ≈ 3.67, but median = 1
    // Jan 1 2024 is a Monday — well within 52 weeks of REF
    const moods = [
      mood(1, "2024-01-01"),
      mood(1, "2024-01-02"),
      mood(9, "2024-01-03"),
    ];
    const { weeklyAggregates } = processWeeklyMoodData(moods, 52, REF);
    expect(weeklyAggregates).toHaveLength(1);
    expect(weeklyAggregates[0].finalAvg).toBe(1); // median
    expect(weeklyAggregates[0].avg).toBeCloseTo(11 / 3, 5); // mean stored separately
  });

  test("stores the mean avg alongside the median finalAvg", () => {
    // [2, 4, 9]: mean = 5, q2 (sorted index 1) = 4
    const moods = [mood(2, "2024-01-01"), mood(4, "2024-01-02"), mood(9, "2024-01-03")];
    const { weeklyAggregates } = processWeeklyMoodData(moods, 52, REF);
    expect(weeklyAggregates[0].avg).toBeCloseTo(5, 5);    // mean
    expect(weeklyAggregates[0].finalAvg).toBe(4);          // q2 median, not mean
  });

  test("groups Mood Entries from different weeks into separate aggregates", () => {
    const moods = [
      mood(3, "2024-01-01"), // week starting Dec 25 2023 (Mon)
      mood(7, "2024-01-08"), // week starting Jan 8 2024 (Mon)
    ];
    const { weeklyAggregates } = processWeeklyMoodData(moods, 52, REF);
    expect(weeklyAggregates).toHaveLength(2);
  });
});
