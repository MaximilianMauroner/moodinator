import { calculateStreak } from "../../../src/features/insights/utils/streaks";
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
  localDateTime: string
) {
  return createMockMoodEntry({
    id,
    mood: value,
    timestamp: new Date(localDateTime).getTime(),
  });
}

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

  it("calculates streaks from the full Mood history", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-03-13T12:00:00"));

    const streak = calculateStreak(
      [
        mood(1, 2, "2024-03-13T12:00:00"),
        mood(2, 3, "2024-03-12T12:00:00"),
        mood(3, 4, "2024-03-10T12:00:00"),
      ],
      new Date("2024-03-13T12:00:00")
    );

    expect(streak).toEqual({ current: 2, longest: 2 });
  });
});

describe("streak calendar days across DST", () => {
  it.each([
    ["2026-03-09T00:30:00", "2026-03-08T12:00:00"],
    ["2026-11-01T23:30:00", "2026-10-31T12:00:00"],
  ])("counts the previous local day at %s", (today, yesterday) => {
    const previousTZ = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      expect(calculateStreak([mood(1, 4, yesterday)], new Date(today))).toEqual({
        current: 1,
        longest: 1,
      });
    } finally {
      if (previousTZ === undefined) delete process.env.TZ;
      else process.env.TZ = previousTZ;
    }
  });
});
