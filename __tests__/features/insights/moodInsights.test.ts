import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockMoodEntry } from "../../db/mockClient";
import {
  buildMoodInsights,
  getMoodsInPeriod,
  getNextPeriodDate,
  getPreviousPeriodDate,
} from "../../../src/features/insights/utils/moodInsights";

function mood(
  id: number,
  value: number,
  localDateTime: string,
  overrides: Partial<ReturnType<typeof createMockMoodEntry>> = {}
) {
  return createMockMoodEntry({
    id,
    mood: value,
    timestamp: new Date(localDateTime).getTime(),
    ...overrides,
  });
}

const higherIsBetterScale = {
  version: 2,
  min: 0,
  max: 10,
  lowerIsBetter: false,
};

describe("moodInsights", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("filters Mood Entries into the selected week and previous week", () => {
    const allMoods = [
      mood(1, 2, "2024-03-04T12:00:00"),
      mood(2, 3, "2024-03-11T12:00:00"),
      mood(3, 4, "2024-03-17T12:00:00"),
      mood(4, 5, "2024-03-18T12:00:00"),
    ];

    const insights = buildMoodInsights(
      allMoods,
      "week",
      new Date("2024-03-13T12:00:00")
    );

    expect(insights.periodMoods.map((entry) => entry.id)).toEqual([2, 3]);
    expect(insights.previousPeriodMoods.map((entry) => entry.id)).toEqual([1]);
    expect(insights.stats.entryCount).toBe(2);
    expect(insights.patterns).toEqual([]);
  });

  it("calculates period navigation dates from the same module as the hook", () => {
    const currentDate = new Date("2024-03-13T12:00:00");

    expect(getPreviousPeriodDate("week", currentDate).getDate()).toBe(6);
    expect(getNextPeriodDate("week", currentDate).getDate()).toBe(20);
    expect(getPreviousPeriodDate("month", currentDate).getMonth()).toBe(1);
    expect(getNextPeriodDate("month", currentDate).getMonth()).toBe(3);
    expect(getPreviousPeriodDate("all", currentDate)).toBe(currentDate);
    expect(getNextPeriodDate("all", currentDate)).toBe(currentDate);
  });

  it("returns all Mood Entries for all-time insights", () => {
    const allMoods = [
      mood(1, 2, "2024-01-01T12:00:00"),
      mood(2, 8, "2024-03-01T12:00:00"),
    ];

    expect(getMoodsInPeriod(allMoods, "all", new Date("2024-03-13T12:00:00")))
      .toBe(allMoods);
  });

  it("runs pattern detection for month and all-time insights", () => {
    const allMoods = [
      mood(1, 9, "2024-03-01T12:00:00", {
        moodScale: higherIsBetterScale,
        emotions: [{ name: "Calm", category: "positive" }],
      }),
      mood(2, 9, "2024-03-02T12:00:00", {
        moodScale: higherIsBetterScale,
        emotions: [{ name: "Calm", category: "positive" }],
      }),
      mood(3, 9, "2024-03-03T12:00:00", {
        moodScale: higherIsBetterScale,
        emotions: [{ name: "Calm", category: "positive" }],
      }),
      mood(4, 2, "2024-03-04T12:00:00", {
        moodScale: higherIsBetterScale,
        emotions: [{ name: "Anxious", category: "negative" }],
      }),
      mood(5, 2, "2024-03-05T12:00:00", {
        moodScale: higherIsBetterScale,
        emotions: [{ name: "Anxious", category: "negative" }],
      }),
      mood(6, 2, "2024-03-06T12:00:00", {
        moodScale: higherIsBetterScale,
        emotions: [{ name: "Anxious", category: "negative" }],
      }),
      mood(7, 5, "2024-03-07T12:00:00"),
    ];

    const insights = buildMoodInsights(
      allMoods,
      "month",
      new Date("2024-03-13T12:00:00")
    );

    expect(insights.patterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "emotion_correlation",
          type: "emotion",
          description: expect.stringContaining("Calm"),
        }),
      ])
    );
  });

  it("calculates streaks from the full Mood history", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-03-13T12:00:00"));

    const insights = buildMoodInsights(
      [
        mood(1, 2, "2024-03-13T12:00:00"),
        mood(2, 3, "2024-03-12T12:00:00"),
        mood(3, 4, "2024-03-10T12:00:00"),
      ],
      "week",
      new Date("2024-03-13T12:00:00")
    );

    expect(insights.streak).toEqual({ current: 2, longest: 2 });
  });
});
