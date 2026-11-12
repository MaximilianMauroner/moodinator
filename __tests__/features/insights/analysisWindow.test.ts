import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockMoodEntry } from "../../db/mockClient";
import {
  analysisStart,
  analyzeMoods,
} from "../../../src/features/insights/utils/analysis";

vi.mock("@/hooks/useColorScheme", () => ({ useColorScheme: () => "dark" }));

const originalTimeZone = process.env.TZ;

beforeEach(() => {
  process.env.TZ = "UTC";
});

afterEach(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});

describe("analysis windows", () => {
  const afternoon = new Date("2026-09-08T15:30:00Z");

  it("starts a numbered range on the first inclusive local day", () => {
    expect(analysisStart("7", afternoon).toISOString()).toBe(
      "2026-09-02T00:00:00.000Z",
    );
    expect(analysisStart("30", afternoon).toISOString()).toBe(
      "2026-08-10T00:00:00.000Z",
    );
    expect(analysisStart("90", afternoon).toISOString()).toBe(
      "2026-06-11T00:00:00.000Z",
    );
    expect(analysisStart("7", new Date("2026-09-08T00:30:00Z")).toISOString()).toBe(
      "2026-09-02T00:00:00.000Z",
    );
  });

  it("uses the older of the oldest entry and now for all history", () => {
    expect(
      analysisStart("all", afternoon, Date.parse("2024-01-15T18:40:00Z")).toISOString(),
    ).toBe("2024-01-15T00:00:00.000Z");
    expect(analysisStart("all", afternoon, null).toISOString()).toBe(
      "2026-09-08T00:00:00.000Z",
    );
    expect(analysisStart("all", afternoon).toISOString()).toBe(
      "2026-09-08T00:00:00.000Z",
    );
    expect(
      analysisStart("all", afternoon, Date.parse("2027-01-01T00:00:00Z")).toISOString(),
    ).toBe("2026-09-08T00:00:00.000Z");
    expect(
      analysisStart("all", afternoon, Date.parse("2026-09-08T22:00:00Z")).toISOString(),
    ).toBe("2026-09-08T00:00:00.000Z");
  });

  it("keeps a seven-day window on calendar dates across the spring-forward", () => {
    process.env.TZ = "America/New_York";
    const start = analysisStart("7", new Date("2026-03-10T15:00:00-04:00"));

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(2);
    expect(start.getDate()).toBe(4);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });

  it("fills every day in the window and places those entries on the rhythm", () => {
    const start = analysisStart("7", afternoon);
    const end = new Date("2026-09-08T00:00:00Z");
    const result = analyzeMoods(
      [
        createMockMoodEntry({
          mood: 2,
          timestamp: Date.parse("2026-09-02T12:00:00Z"),
          utcOffsetMinutes: 0,
        }),
        createMockMoodEntry({
          mood: 8,
          timestamp: Date.parse("2026-09-08T18:00:00Z"),
          utcOffsetMinutes: 0,
        }),
      ],
      start,
      end,
    );

    expect(result.dailySeries.map((point) => point.day)).toEqual([
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
      "2026-09-07",
      "2026-09-08",
    ]);
    expect(result.dailySeries[0]).toMatchObject({ mean: 2, min: 2, max: 2, count: 1 });
    expect(result.dailySeries[6]).toMatchObject({ mean: 8, min: 8, max: 8, count: 1 });
    expect(result.dailySeries.slice(1, 6).every((point) => point.mean === null)).toBe(
      true,
    );
    expect(result.rhythm.find((cell) => cell.daypart === 1 && cell.weekday === 2)).toMatchObject({
      count: 1,
      mean: 2,
    });
    expect(result.rhythm.find((cell) => cell.daypart === 2 && cell.weekday === 1)).toMatchObject({
      count: 1,
      mean: 8,
    });
    expect(result.drivers).toEqual([]);
  });
});
