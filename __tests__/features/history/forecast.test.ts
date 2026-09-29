import { describe, expect, it } from "vitest";

import { createMockMoodEntry } from "../../db/mockClient";
import { buildForecastDays } from "@/features/history/forecast";

function mood(value: number, local: [number, number, number, number]) {
  const [year, month, day, hour] = local;
  return createMockMoodEntry({
    mood: value,
    timestamp: new Date(year, month - 1, day, hour).getTime(),
    utcOffsetMinutes: null,
  });
}

describe("buildForecastDays", () => {
  const today = new Date(2026, 8, 28, 21, 40);

  it("returns every day newest first with the lightest, heaviest, and average rating", () => {
    const days = buildForecastDays(
      [mood(7, [2026, 9, 27, 22]), mood(3, [2026, 9, 27, 9]), mood(6, [2026, 9, 27, 18]), mood(4, [2026, 9, 28, 13])],
      today,
    );

    expect(days.map((day) => day.dayKey)).toEqual([
      "2026-09-28", "2026-09-27", "2026-09-26", "2026-09-25", "2026-09-24", "2026-09-23", "2026-09-22",
    ]);
    expect(days[1]).toMatchObject({ lightest: 3, heaviest: 7, average: 16 / 3 });
    expect(days[1]!.entries.map((entry) => entry.mood)).toEqual([3, 6, 7]);
    expect(days[2]).toMatchObject({ entries: [], lightest: null, heaviest: null, average: null });
  });

  it("buckets by the recorded local day, not this device's day", () => {
    // Recorded at 01:00 on 22 Sep in UTC+14, which is 21 Sep 11:00 UTC.
    const traveled = createMockMoodEntry({
      mood: 3,
      timestamp: Date.UTC(2026, 8, 21, 11),
      utcOffsetMinutes: -14 * 60,
    });
    const days = buildForecastDays([traveled], today);
    expect(days.find((day) => day.dayKey === "2026-09-22")!.entries).toEqual([traveled]);
  });

  it("ignores entries outside the window", () => {
    const days = buildForecastDays([mood(2, [2026, 9, 20, 9])], today);
    expect(days.every((day) => day.entries.length === 0)).toBe(true);
  });
});
