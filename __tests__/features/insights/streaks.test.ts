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
});
