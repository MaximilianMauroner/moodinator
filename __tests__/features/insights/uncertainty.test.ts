import { describe, expect, it, vi } from "vitest";
import { createMockMoodEntry } from "../../db/mockClient";

// rhythm pulls in the theme, which reaches react-native. Same seam as analysis.test.ts.
vi.mock("@/hooks/useColorScheme", () => ({ useColorScheme: () => "dark" }));

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
    expect(result[0].text).toContain("too much to tell apart");
    // It must not promise that more entries will resolve it.
    expect(result[0].text).not.toMatch(/Add \d+ more/);
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
});
