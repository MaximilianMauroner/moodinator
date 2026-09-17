import { describe, expect, it, vi } from "vitest";
import { createMockMoodEntry } from "../../db/mockClient";

// rhythm pulls in the theme, which reaches react-native. Same seam as analysis.test.ts.
vi.mock("@/hooks/useColorScheme", () => ({ useColorScheme: () => "dark" }));

import { analyzeMoods } from "../../../src/features/insights/utils/analysis";
import { drivers } from "../../../src/features/insights/utils/drivers";
import { rhythm } from "../../../src/features/insights/utils/rhythm";
import { findings, rangeWords } from "../../../src/features/insights/utils/findings";
import {
  compareGroups,
  emptyGroup,
  addToGroup,
} from "../../../src/features/insights/utils/statistics";

/**
 * A claim is only shown when the interval around it stays on one side of zero.
 * These fixtures carry real spread, unlike the fixed-rating fixtures used for
 * the arithmetic in analysis.test.ts.
 */
const tagged = (moods: number[], tags: string[] = []) =>
  moods.map((mood) =>
    createMockMoodEntry({
      mood,
      contextTags: tags,
      timestamp: new Date("2026-09-07T12:00:00").getTime(),
    }),
  );

const group = (values: number[]) => {
  const stats = emptyGroup();
  values.forEach((value) => addToGroup(stats, value));
  return stats;
};

describe("comparison intervals", () => {
  it("separates groups that do not overlap", () => {
    const result = compareGroups(group([1, 1, 2, 1, 2]), group([8, 9, 8, 9, 8]));

    expect(result.separated).toBe(true);
    expect(result.effect).toBeLessThan(0);
    expect(result.ciLow).toBeLessThan(result.effect);
    expect(result.ciHigh).toBeGreaterThan(result.effect);
    expect(result.ciHigh).toBeLessThan(0);
  });

  it("does not separate groups that overlap heavily", () => {
    const result = compareGroups(group([0, 10, 1, 9, 5]), group([5, 4, 6, 5, 5]));

    expect(result.separated).toBe(false);
    expect(result.ciLow).toBeLessThan(0);
    expect(result.ciHigh).toBeGreaterThan(0);
  });

  it("reports a point interval when neither group varies", () => {
    const result = compareGroups(group([2, 2, 2, 2, 2]), group([8, 8, 8, 8, 8]));

    expect(result.effect).toBe(-6);
    expect(result.ciLow).toBe(-6);
    expect(result.ciHigh).toBe(-6);
    expect(result.separated).toBe(true);
  });

  it("does not separate two identical groups", () => {
    const result = compareGroups(group([5, 5, 5, 5, 5]), group([5, 5, 5, 5, 5]));

    expect(result.effect).toBe(0);
    expect(result.separated).toBe(false);
  });

  /**
   * At the five-entry floor a normal critical value is far too narrow. These
   * two groups differ by 3 with a standard error of sqrt(2): a normal bound
   * ends at -0.23 and claims a pattern, a t bound at 8 degrees of freedom ends
   * at +0.26 and does not.
   */
  it("uses a small-sample critical value at the group floor", () => {
    const result = compareGroups(group([0, 0, 0, 0, 5]), group([3, 3, 3, 3, 8]));

    expect(result.effect).toBe(-3);
    expect(result.separated).toBe(false);
    expect(result.ciHigh).toBeGreaterThan(0);
    // margin / standardError is the critical value. t(8, 0.975) = 2.306.
    expect((result.ciHigh - result.effect) / Math.SQRT2).toBeCloseTo(2.306, 3);
  });

  it("widens the interval when the analysis runs many comparisons", () => {
    const a = group([1, 2, 3, 2, 1]);
    const b = group([5, 6, 7, 6, 5]);
    const alone = compareGroups(a, b);
    const among = compareGroups(a, b, 28);

    expect(among.ciHigh - among.effect).toBeGreaterThan(
      alone.ciHigh - alone.effect,
    );
    expect(among.effect).toBe(alone.effect);
  });

  /**
   * The critical value has to stay accurate once the confidence level is
   * divided, because that pushes p far into the tail. A series expansion around
   * the normal quantile drifted there and flipped this decision.
   */
  it("stays accurate in the tail after a heavy correction", () => {
    const result = compareGroups(group([0, 0, 0, 0, 4]), group([9, 9, 9, 9, 9]), 100);

    // Welch degrees of freedom are 4 and the standard error is 0.8.
    expect((result.ciHigh - result.effect) / 0.8).toBeCloseTo(10.3063, 3);
    expect(result.ciHigh).toBeGreaterThan(0);
    expect(result.separated).toBe(false);
  });

  it("still separates a real difference measured across many entries", () => {
    const even = (value: number, other: number) =>
      group(Array.from({ length: 60 }, (_, i) => (i % 2 ? value : other)));

    expect(compareGroups(even(2, 3), even(7, 8), 28).separated).toBe(true);
  });
});

describe("driver suppression", () => {
  it("keeps a tag whose groups are clearly apart", () => {
    const data = [
      ...tagged([1, 2, 1, 2, 1], ["Outside"]),
      ...tagged([8, 9, 8, 9, 8]),
    ];

    const analysis = drivers(data);

    expect(analysis.drivers.map((d) => d.name)).toEqual(["Outside"]);
    expect(analysis.inconclusive).toEqual([]);
    const [driver] = analysis.drivers;
    expect(driver.ciLow).toBeLessThanOrEqual(driver.effect);
    expect(driver.ciHigh).toBeGreaterThanOrEqual(driver.effect);
  });

  it("suppresses a tag whose groups overlap, and says why", () => {
    const data = [
      ...tagged([0, 10, 1, 9, 5], ["Work"]),
      ...tagged([5, 4, 6, 5, 5]),
    ];

    const analysis = drivers(data);

    expect(analysis.drivers).toEqual([]);
    expect(analysis.inconclusive).toEqual([{ name: "Work" }]);
    // Sample size is adequate, so it must not be reported as a shortfall.
    expect(analysis.shortfalls).toEqual([]);
  });

  it("still reports a shortfall when a group is too small", () => {
    const data = [...tagged([2, 3], ["Rare"]), ...tagged([7, 8, 7, 8, 7])];

    const analysis = drivers(data);

    expect(analysis.drivers).toEqual([]);
    expect(analysis.shortfalls[0]).toMatchObject({ name: "Rare" });
  });
});

describe("findings copy", () => {
  it("attaches a range to every claim it shows", () => {
    const data = [
      ...tagged([1, 2, 1, 2, 1], ["Outside"]),
      ...tagged([8, 9, 8, 9, 8]),
    ];

    const result = findings(drivers(data), rhythm(data), data.length);
    const claims = result.filter((f) => f.effect !== null);

    expect(claims.length).toBeGreaterThan(0);
    for (const claim of claims) {
      expect(claim.range).toBeDefined();
      expect(claim.text).not.toMatch(/\b(because|caused?|makes? you)\b/i);
    }
  });

  it("explains an overlap differently from a shortage", () => {
    const overlapping = [
      ...tagged([0, 10, 1, 9, 5], ["Work"]),
      ...tagged([5, 4, 6, 5, 5]),
    ];

    const result = findings(
      drivers(overlapping),
      rhythm(overlapping),
      overlapping.length,
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("inconclusive");
    expect(result[0].text).toContain("does not stand apart");
    // It must not promise that more entries will resolve it.
    expect(result[0].text).not.toMatch(/Add \d+ more/);
  });

  /**
   * Identical groups fail to separate for the opposite reason to scattered
   * ones: there is nothing to tell apart, not too much noise. The message has
   * to fit both, so it must not name variance as the cause.
   */
  it("does not blame variance when no group varies", () => {
    const flat = [...tagged([5, 5, 5, 5, 5], ["Work"]), ...tagged([5, 5, 5, 5, 5])];

    const result = findings(drivers(flat), rhythm(flat), flat.length);

    expect(result[0].id).toBe("inconclusive");
    expect(result[0].text).not.toMatch(/var(y|ies|iance)|too much/i);
  });

  it("keeps the shortage message when entries are genuinely missing", () => {
    const sparse = [...tagged([2, 3], ["Rare"]), ...tagged([7, 8, 7, 8, 7])];

    const result = findings(drivers(sparse), rhythm(sparse), sparse.length);

    expect(result[result.length - 1].id).toBe("insufficient");
    expect(result[result.length - 1].text).toContain("Rare");
  });

  it("falls back to the generic message with no data at all", () => {
    const result = findings(drivers([]), rhythm([]), 0);

    expect(result).toHaveLength(1);
    expect(result[0].text).toContain("5 entries in each group");
  });
});

/**
 * analyzeMoods is where the driver groups and the time slots are joined into
 * one family of comparisons. Splitting the confidence level across them is only
 * worth doing if a real pattern still survives it, so both directions are
 * pinned here rather than on the two halves alone.
 */
describe("analyzeMoods", () => {
  const atDay = (mood: number, day: number, tags: string[] = []) =>
    createMockMoodEntry({
      mood,
      contextTags: tags,
      timestamp: new Date(2026, 8, 7 + day, 12, 0, 0).getTime(),
    });

  const start = new Date(2026, 8, 7);
  const end = new Date(2026, 8, 27);

  it("still reports a strong pattern after splitting the confidence level", () => {
    const data = Array.from({ length: 40 }, (_, i) =>
      i % 2 === 0
        ? atDay(i % 4 === 0 ? 1 : 2, i % 20, ["Outside"])
        : atDay(i % 4 === 1 ? 8 : 9, i % 20),
    );

    const result = analyzeMoods(data, start, end);

    expect(result.drivers.map((d) => d.name)).toContain("Outside");
    expect(result.findings.some((f) => f.effect !== null)).toBe(true);
  });

  /**
   * The Drivers card shows one of two messages when it has no driver to list.
   * Both cases leave `drivers` empty, so the card reads `inconclusiveDrivers`
   * to tell "measured, no difference" apart from "not enough entries yet".
   */
  it("reports a measured group that did not separate", () => {
    const data = [...tagged([5, 5, 5, 5, 5], ["Work"]), ...tagged([5, 5, 5, 5, 5])];

    const result = analyzeMoods(data, start, end);

    expect(result.drivers).toEqual([]);
    expect(result.inconclusiveDrivers).toEqual([{ name: "Work" }]);
  });

  it("leaves the inconclusive list empty when a group is only too small", () => {
    const data = [...tagged([2, 3], ["Rare"]), ...tagged([7, 8, 7, 8, 7])];

    const result = analyzeMoods(data, start, end);

    expect(result.drivers).toEqual([]);
    expect(result.inconclusiveDrivers).toEqual([]);
  });

  /**
   * One row at the epoch sentinel must not stretch a dated range back to 1970.
   * Before this, "All history" started there and the trend chart drew every day
   * since, squeezing the real history into its last pixels.
   */
  it("keeps an unreadable date out of the dated ranges", () => {
    const data = [
      ...tagged([4, 5, 4, 5, 4]),
      createMockMoodEntry({ mood: 6, timestamp: 0 }),
    ];

    const result = analyzeMoods(data, start, end);

    expect(result.dailySeries.length).toBeLessThan(400);
    expect(result.dailySeries.some((point) => point.day.startsWith("1970"))).toBe(
      false,
    );
    // The epoch is not a real Thursday night, so no slot counts it.
    expect(
      result.rhythm.reduce((total, cell) => total + cell.count, 0),
    ).toBe(5);
  });

  it("claims nothing from noise spread over many candidates", () => {
    // Ratings cycle independently of the tag, so no group differs from the
    // rest. Testing this many candidates at a flat 95% would be likely to
    // surface one of them anyway.
    const data = Array.from({ length: 80 }, (_, i) =>
      atDay((i % 9) + 1, i % 20, [`Tag${i % 6}`]),
    );

    const result = analyzeMoods(data, start, end);

    expect(result.drivers).toEqual([]);
    expect(result.findings.every((f) => f.effect === null)).toBe(true);
  });
});

describe("rangeWords", () => {
  it("reads as one direction when the interval stays on one side", () => {
    expect(rangeWords(-2.4, -0.6)).toBe("Somewhere between 0.6 and 2.4 better.");
    expect(rangeWords(0.6, 2.4)).toBe("Somewhere between 0.6 and 2.4 worse.");
  });

  it("names both directions when the interval crosses zero", () => {
    expect(rangeWords(-1.2, 0.8)).toBe(
      "Somewhere between 1.2 better and 0.8 worse.",
    );
  });

  it("orders the bounds regardless of how they arrive", () => {
    expect(rangeWords(2.4, 0.6)).toBe(rangeWords(0.6, 2.4));
  });

  /**
   * A range is only shown because the interval excludes zero, so rounding a
   * bound to 0.0 would deny the evidence the claim rests on.
   */
  it("does not round a bound down to nothing", () => {
    expect(rangeWords(-0.044, -0.016)).toBe("Less than 0.1 better.");
    expect(rangeWords(-0.174, -0.026)).toBe(
      "Somewhere between less than 0.1 and 0.2 better.",
    );
    expect(rangeWords(0.016, 0.044)).toBe("Less than 0.1 worse.");
  });
});
