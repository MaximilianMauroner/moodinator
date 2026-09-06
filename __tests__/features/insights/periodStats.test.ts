import { describe, expect, it } from "vitest";

import { createMockMoodEntry } from "../../db/mockClient";
import { getNeutralMoodRating } from "../../../src/constants/moodScaleInterpretation";
import { calculatePeriodStats } from "../../../src/features/insights/utils/periodStats";

function mood(value: number, isoDate: string) {
  return createMockMoodEntry({
    mood: value,
    timestamp: new Date(isoDate).getTime(),
  });
}

function higherIsBetterMood(value: number, isoDate: string) {
  return createMockMoodEntry({
    mood: value,
    timestamp: new Date(isoDate).getTime(),
    moodScale: {
      version: 2,
      min: 0,
      max: 10,
      lowerIsBetter: false,
    },
  });
}

describe("calculatePeriodStats", () => {
  it("uses the Mood Scale neutral fallback when there are no Mood Entries", () => {
    const stats = calculatePeriodStats([], []);

    expect(stats.averageMood).toBe(getNeutralMoodRating());
    expect(stats.mostCommonMood).toBe(getNeutralMoodRating());
    expect(stats.trendDirection).toBe("stable");
  });

  it("orders best and worst days by Mood Scale semantics", () => {
    const stats = calculatePeriodStats(
      [
        mood(8, "2024-01-01T12:00:00Z"),
        mood(2, "2024-01-02T12:00:00Z"),
      ],
      []
    );

    expect(stats.bestDay).toBe("Tuesday");
    expect(stats.worstDay).toBe("Monday");
  });

  it("uses Mood Scale semantics to break most-common Mood Rating ties", () => {
    const stats = calculatePeriodStats(
      [
        mood(8, "2024-01-01T12:00:00Z"),
        mood(2, "2024-01-02T12:00:00Z"),
      ],
      []
    );

    expect(stats.mostCommonMood).toBe(2);
  });

  it("normalizes mixed stored scales before averaging and comparing periods", () => {
    const stats = calculatePeriodStats(
      [
        higherIsBetterMood(9, "2024-01-01T12:00:00Z"),
        mood(3, "2024-01-02T12:00:00Z"),
      ],
      [higherIsBetterMood(2, "2023-12-26T12:00:00Z")]
    );

    expect(stats.averageMood).toBe(2);
    expect(stats.moodChange).toBe(-6);
    expect(stats.trendDirection).toBe("down");
    expect(stats.bestDay).toBe("Monday");
  });
});
