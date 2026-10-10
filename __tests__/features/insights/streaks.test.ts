import { describe, expect, it } from "vitest";
import { createMockMoodEntry } from "../../db/mockClient";
import { calculateStreak } from "../../../src/features/insights/utils/streaks";
const at = (date: string) =>
  createMockMoodEntry({ timestamp: new Date(`${date}T12:00:00`).getTime() });
describe("streak baseline", () => {
  it("counts unique days and allows yesterday as current", () => {
    expect(
      calculateStreak(
        [at("2026-09-05"), at("2026-09-05"), at("2026-09-04")],
        new Date("2026-09-06T12:00:00"),
      ),
    ).toEqual({ current: 2, longest: 2 });
  });
  it("retains longest across gaps with no current streak", () => {
    expect(
      calculateStreak(
        [at("2026-09-02"), at("2026-09-01"), at("2026-08-20")],
        new Date("2026-09-06T12:00:00"),
      ),
    ).toEqual({ current: 0, longest: 2 });
    expect(calculateStreak([])).toEqual({ current: 0, longest: 0 });
  });
  it("calculates streaks from the full Mood history", () => {
    expect(
      calculateStreak(
        [at("2024-03-13"), at("2024-03-12"), at("2024-03-10")],
        new Date("2024-03-13T12:00:00"),
      ),
    ).toEqual({ current: 2, longest: 2 });
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
      const entry = createMockMoodEntry({
        id: 1,
        mood: 4,
        timestamp: new Date(yesterday).getTime(),
      });
      expect(calculateStreak([entry], new Date(today))).toEqual({
        current: 1,
        longest: 1,
      });
    } finally {
      if (previousTZ === undefined) delete process.env.TZ;
      else process.env.TZ = previousTZ;
    }
  });
});
