/**
 * Comparison of two groups of mood ratings.
 *
 * Insight cards state a difference in plain language, so the difference has to
 * be one the data actually supports. Ranking candidates by effect size alone
 * selects for noise: the app compares every tag and every time slot, and the
 * largest gap in a handful of entries is usually the least reliable one.
 *
 * Each comparison therefore carries a 95% interval around the difference, and a
 * claim is only shown when that interval stays on one side of zero.
 */

export interface GroupStats {
  count: number;
  sum: number;
  sumSquares: number;
}

export function emptyGroup(): GroupStats {
  return { count: 0, sum: 0, sumSquares: 0 };
}

export function addToGroup(group: GroupStats, value: number): void {
  group.count += 1;
  group.sum += value;
  group.sumSquares += value * value;
}

export function mergeGroups(groups: Iterable<GroupStats>): GroupStats {
  const total = emptyGroup();
  for (const group of groups) {
    total.count += group.count;
    total.sum += group.sum;
    total.sumSquares += group.sumSquares;
  }
  return total;
}

export function subtractGroup(whole: GroupStats, part: GroupStats): GroupStats {
  return {
    count: whole.count - part.count,
    sum: whole.sum - part.sum,
    sumSquares: whole.sumSquares - part.sumSquares,
  };
}

export function groupMean(group: GroupStats): number {
  return group.count > 0 ? group.sum / group.count : 0;
}

/**
 * Sample variance. A single observation has no spread to measure, so it
 * contributes zero rather than an undefined value. Accumulated rounding can
 * push a zero-spread group slightly negative, which is clamped.
 */
function sampleVariance(group: GroupStats): number {
  if (group.count < 2) {
    return 0;
  }
  const variance =
    (group.sumSquares - (group.sum * group.sum) / group.count) / (group.count - 1);
  return variance > 0 ? variance : 0;
}

// Normal approximation. The group-size floor makes the t correction smaller
// than the precision these cards report, and it avoids carrying a t table.
const Z_95 = 1.959964;

export interface Comparison {
  effect: number;
  ciLow: number;
  ciHigh: number;
  /** The interval stays on one side of zero. */
  separated: boolean;
}

export function compareGroups(group: GroupStats, rest: GroupStats): Comparison {
  const effect = groupMean(group) - groupMean(rest);
  const standardError = Math.sqrt(
    sampleVariance(group) / Math.max(group.count, 1) +
      sampleVariance(rest) / Math.max(rest.count, 1)
  );
  const margin = Z_95 * standardError;
  const ciLow = effect - margin;
  const ciHigh = effect + margin;

  return { effect, ciLow, ciHigh, separated: ciLow > 0 || ciHigh < 0 };
}
