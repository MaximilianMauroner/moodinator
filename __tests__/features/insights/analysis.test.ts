import { describe, expect, it, vi } from "vitest";
import { createMockMoodEntry } from "../../db/mockClient";
import { drivers } from "../../../src/features/insights/utils/drivers";
import { dailySeries } from "../../../src/features/insights/utils/dailySeries";
import {
  rhythm,
  rhythmCellColor,
} from "../../../src/features/insights/utils/rhythm";
import { trendGeometry } from "../../../src/features/insights/utils/trendGeometry";
import { getThemedColor } from "../../../src/constants/colors";
import { calculateStreak } from "../../../src/features/insights/utils/streaks";
vi.mock("@/hooks/useColorScheme", () => ({ useColorScheme: () => "dark" }));
const entry = (
  mood: number,
  tags: string[] = [],
  date = "2026-09-07T12:00:00",
) =>
  createMockMoodEntry({
    mood,
    contextTags: tags,
    timestamp: new Date(date).getTime(),
  });
const five = (mood: number, tags: string[] = []) =>
  Array.from({ length: 5 }, () => entry(mood, tags));
describe("shared insights analysis", () => {
  it("compares interpreted means with deduplicated tags and 5/5 gates", () => {
    const data = [...five(2, ["Outside", "Outside"]), ...five(8)];
    expect(drivers(data)[0]).toMatchObject({
      withMean: 2,
      withoutMean: 8,
      withCount: 5,
      withoutCount: 5,
    });
    expect(drivers(data.slice(1))).toEqual([]);
    expect(drivers(data.slice(0, 9))).toEqual([]);
    data.slice(0, 5).forEach((e) => {
      e.mood = 8;
      e.moodScale = { version: 2, min: 0, max: 10, lowerIsBetter: false };
    });
    expect(drivers(data)[0]).toMatchObject({ withMean: 2, withoutMean: 8 });
  });
  it("keeps emotion and context names independent", () => {
    const data = [...five(2, ["Calm"]), ...five(8)];
    data.slice(5).forEach((e) => {
      e.emotions = [{ name: "Calm", category: "positive" }];
    });
    expect(drivers(data).map((d) => d.id)).toEqual([
      "context:Calm",
      "emotion:Calm",
    ]);
  });
  it("returns null gaps and aggregates all intra-day entries", () => {
    const series = dailySeries(
      [entry(2), entry(8)],
      new Date("2026-09-06"),
      new Date("2026-09-08"),
    );
    expect(series.map((p) => p.mean)).toEqual([null, 5, null]);
    expect(series[1]).toMatchObject({ min: 2, max: 8, count: 2 });
  });
  it("uses recorded timezone for daily series, rhythm and streaks", () => {
    const data = [
      createMockMoodEntry({
        mood: 2,
        timestamp: Date.parse("2026-09-07T23:30:00Z"),
        utcOffsetMinutes: -120,
      }),
    ];
    expect(
      dailySeries(data, new Date("2026-09-07"), new Date("2026-09-08"))[1]
        .count,
    ).toBe(1);
    expect(rhythm(data).find((c) => c.count)).toMatchObject({
      weekday: 1,
      daypart: 0,
    });
    expect(calculateStreak(data, new Date("2026-09-08T12:00:00"))).toEqual({
      current: 1,
      longest: 1,
    });
  });
  it("buckets noon and 23:30 correctly and leaves empty cells neutral", () => {
    const cells = rhythm([entry(2), entry(8, [], "2026-09-07T23:30:00")]);
    expect(cells.find((c) => c.daypart === 1 && c.weekday === 0)?.mean).toBe(2);
    expect(cells.find((c) => c.daypart === 3 && c.weekday === 0)?.mean).toBe(8);
    for (const dark of [true, false])
      expect(rhythmCellColor(cells[0], dark)).toBe(
        getThemedColor("surfaceAlt", dark),
      );
  });
  it("shows equal and overlapping descriptive comparisons instead of selecting patterns", () => {
    const data = [...five(4, ["Outside"]), ...five(4)];
    expect(drivers(data)).toMatchObject([
      { name: "Outside", withMean: 4, withoutMean: 4, withCount: 5, withoutCount: 5 },
    ]);
  });
  it("draws stable geometry, breaks at gaps and preserves singleton points", () => {
    const series = dailySeries(
      [
        entry(2, [], "2026-09-06T12:00:00"),
        entry(8, [], "2026-09-08T12:00:00"),
      ],
      new Date("2026-09-06"),
      new Date("2026-09-08"),
    );
    const geometry = trendGeometry(series);
    expect(geometry.lines).toEqual(["M0.00,24.00", "M300.00,96.00"]);
    expect(geometry.dots).toHaveLength(2);
    expect(trendGeometry(series)).toEqual(geometry);
    expect(trendGeometry([])).toEqual({ lines: [], bands: [], dots: [], whiskers: [] });
  });
  it("preserves the min-max range on an isolated logged day", () => {
    const series = dailySeries(
      [entry(0), entry(10)],
      new Date("2026-09-06"),
      new Date("2026-09-08"),
    );
    expect(trendGeometry(series).whiskers).toEqual([
      { x: 150, minY: 0, maxY: 120 },
    ]);
  });
});
