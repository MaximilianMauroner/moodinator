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

/** Log gamma, Lanczos approximation with g = 7. */
function logGamma(value: number): number {
  const LANCZOS = [
    0.9999999999998099, 676.5203681218851, -1259.1392167224028,
    771.3234287776531, -176.6150291621406, 12.507343278686905,
    -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7,
  ];
  const z = value - 1;
  let series = LANCZOS[0];
  for (let i = 1; i < LANCZOS.length; i += 1) {
    series += LANCZOS[i] / (z + i);
  }
  const t = z + 7.5;
  return (
    0.5 * Math.log(2 * Math.PI) +
    (z + 0.5) * Math.log(t) -
    t +
    Math.log(series)
  );
}

/** Continued fraction for the incomplete beta function, by Lentz's method. */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const TINY = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) {
    d = TINY;
  }
  d = 1 / d;
  let result = d;

  for (let m = 1; m <= 300; m += 1) {
    const even = 2 * m;
    let numerator = (m * (b - m) * x) / ((qam + even) * (a + even));
    d = 1 + numerator * d;
    if (Math.abs(d) < TINY) {
      d = TINY;
    }
    c = 1 + numerator / c;
    if (Math.abs(c) < TINY) {
      c = TINY;
    }
    d = 1 / d;
    result *= d * c;

    numerator = (-(a + m) * (qab + m) * x) / ((a + even) * (qap + even));
    d = 1 + numerator * d;
    if (Math.abs(d) < TINY) {
      d = TINY;
    }
    c = 1 + numerator / c;
    if (Math.abs(c) < TINY) {
      c = TINY;
    }
    d = 1 / d;
    const step = d * c;
    result *= step;
    if (Math.abs(step - 1) < 1e-15) {
      break;
    }
  }
  return result;
}

/** Regularized incomplete beta, the CDF Student's t is expressed through. */
function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) {
    return 0;
  }
  if (x >= 1) {
    return 1;
  }
  const front = Math.exp(
    logGamma(a + b) -
      logGamma(a) -
      logGamma(b) +
      a * Math.log(x) +
      b * Math.log(1 - x)
  );
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(a, b, x)) / a
    : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

function studentCdf(t: number, degreesOfFreedom: number): number {
  const x = degreesOfFreedom / (degreesOfFreedom + t * t);
  const tail =
    0.5 * regularizedIncompleteBeta(degreesOfFreedom / 2, 0.5, x);
  return t > 0 ? 1 - tail : tail;
}

/**
 * Quantile of Student's t for p >= 0.5, inverted from the CDF by bisection.
 *
 * A series expansion around the normal quantile was tried first and is not
 * good enough. Dividing the confidence level across many comparisons pushes p
 * far into the tail, where the expansion drifts: at four degrees of freedom
 * and a hundred comparisons it returns 10.10 against a true 10.31, which is
 * the difference between publishing a pattern and suppressing it. Bisecting an
 * accurate CDF costs a few hundred evaluations per analysis and removes the
 * question.
 */
function studentQuantile(p: number, degreesOfFreedom: number): number {
  let high = 2;
  while (studentCdf(high, degreesOfFreedom) < p && high < 1e9) {
    high *= 2;
  }
  let low = 0;
  for (let i = 0; i < 100; i += 1) {
    const middle = (low + high) / 2;
    if (studentCdf(middle, degreesOfFreedom) < p) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
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
