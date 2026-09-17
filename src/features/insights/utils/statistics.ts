/**
 * Comparison of two groups of mood ratings.
 *
 * Insight cards state a difference in plain language, so the difference has to
 * be one the data actually supports. Ranking candidates by effect size alone
 * selects for noise: the app compares every tag and every time slot, and the
 * largest gap in a handful of entries is usually the least reliable one.
 *
 * Each comparison therefore carries an interval around the difference, and a
 * claim is only shown when that interval stays on one side of zero. Two things
 * widen that interval past a textbook 95% bound:
 *
 * - Groups start at five entries, where a normal critical value is much too
 *   narrow. The interval uses a Student t value at the Welch degrees of
 *   freedom instead.
 * - One analysis compares every tag, every emotion and up to 28 time slots.
 *   The confidence level is divided across those comparisons, so the analysis
 *   as a whole has about a 5% chance of a false claim, rather than each
 *   candidate having one.
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

const CONFIDENCE = 0.95;

/**
 * Welch-Satterthwaite degrees of freedom. Two groups that both have no spread
 * leave a zero denominator, and the interval is zero wide in that case, so the
 * value returned there only has to be finite.
 */
function welchDegreesOfFreedom(a: GroupStats, b: GroupStats): number {
  const varianceA = sampleVariance(a) / Math.max(a.count, 1);
  const varianceB = sampleVariance(b) / Math.max(b.count, 1);
  const denominator =
    (varianceA * varianceA) / Math.max(a.count - 1, 1) +
    (varianceB * varianceB) / Math.max(b.count - 1, 1);
  return denominator > 0 ? (varianceA + varianceB) ** 2 / denominator : 1;
}

// Acklam's rational approximation to the inverse normal CDF.
const CENTRAL = [
  -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
  1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
];
const CENTRAL_DIVISOR = [
  -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
  6.680131188771972e1, -1.328068155288572e1,
];
const TAIL = [
  -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
  -2.549732539343734, 4.374664141464968, 2.938163982698783,
];
const TAIL_DIVISOR = [
  7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
  3.754408661907416,
];
const TAIL_START = 1 - 0.02425;

/**
 * Quantile of the standard normal. Only the upper half is needed here, so only
 * the two branches that cover p in [0.5, 1) are carried. Accurate to about
 * 1e-9, far past anything these intervals resolve.
 */
function normalQuantile(p: number): number {
  if (p <= TAIL_START) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((CENTRAL[0] * r + CENTRAL[1]) * r + CENTRAL[2]) * r + CENTRAL[3]) * r +
        CENTRAL[4]) *
        r +
        CENTRAL[5]) *
        q) /
      (((((CENTRAL_DIVISOR[0] * r + CENTRAL_DIVISOR[1]) * r +
        CENTRAL_DIVISOR[2]) *
        r +
        CENTRAL_DIVISOR[3]) *
        r +
        CENTRAL_DIVISOR[4]) *
        r +
        1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((TAIL[0] * q + TAIL[1]) * q + TAIL[2]) * q + TAIL[3]) * q + TAIL[4]) *
      q +
      TAIL[5]) /
    ((((TAIL_DIVISOR[0] * q + TAIL_DIVISOR[1]) * q + TAIL_DIVISOR[2]) * q +
      TAIL_DIVISOR[3]) *
      q +
      1)
  );
}

/**
 * Quantile of Student's t, a Cornish-Fisher expansion around the normal
 * quantile. The Welch degrees of freedom are a continuous value that the group
 * floor does not pin down, so a table would have to be interpolated anyway.
 *
 * The error is under 0.001 at the five-entry floor with one comparison. It
 * grows to roughly 1% only where a small group meets a heavily divided
 * confidence level, which is small next to the correction itself: it more than
 * doubles the critical value there.
 */
function studentQuantile(p: number, degreesOfFreedom: number): number {
  const z = normalQuantile(p);
  // Past this point t and the normal agree to well under the precision an
  // insight card reports.
  if (degreesOfFreedom >= 1000) {
    return z;
  }
  const df = degreesOfFreedom;
  const z2 = z * z;
  const z3 = z2 * z;
  const z5 = z3 * z2;
  const z7 = z5 * z2;
  const z9 = z7 * z2;
  return (
    z +
    (z3 + z) / (4 * df) +
    (5 * z5 + 16 * z3 + 3 * z) / (96 * df ** 2) +
    (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * df ** 3) +
    (79 * z9 + 776 * z7 + 1482 * z5 - 1920 * z3 - 945 * z) / (92160 * df ** 4)
  );
}

export interface Comparison {
  effect: number;
  ciLow: number;
  ciHigh: number;
  /** The interval stays on one side of zero. */
  separated: boolean;
}

export function compareGroups(
  group: GroupStats,
  rest: GroupStats,
  /**
   * How many comparisons the whole analysis runs. The confidence level is
   * divided across them, so one analysis has about a 5% chance of any false
   * claim instead of a 5% chance per candidate.
   *
   * This is the conservative correction rather than a false-discovery one. A
   * card asserts a pattern in someone's own mood history as fact, so inventing
   * a pattern costs more than staying quiet about a real one.
   */
  comparisons = 1
): Comparison {
  const effect = groupMean(group) - groupMean(rest);
  const standardError = Math.sqrt(
    sampleVariance(group) / Math.max(group.count, 1) +
      sampleVariance(rest) / Math.max(rest.count, 1)
  );
  const alpha = (1 - CONFIDENCE) / Math.max(comparisons, 1);
  const critical = studentQuantile(
    1 - alpha / 2,
    welchDegreesOfFreedom(group, rest)
  );
  const margin = critical * standardError;
  const ciLow = effect - margin;
  const ciHigh = effect + margin;

  return { effect, ciLow, ciHigh, separated: ciLow > 0 || ciHigh < 0 };
}
