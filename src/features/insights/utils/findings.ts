import type { DriverAnalysis } from "./drivers";
import { MIN_GROUP_SIZE } from "./drivers";
import type { RhythmCell } from "./rhythm";
import { DAYPARTS, WEEKDAYS } from "./rhythm";
import {
  compareGroups,
  confidenceInterval,
  mergeGroups,
  subtractGroup,
  type GroupStats,
} from "./statistics";
export interface Finding {
  id: string;
  text: string;
  sample: string;
  effect: number | null;
  means?: [number, number];
  /** Range the comparison supports, shown so a claim is not read as exact. */
  range?: [number, number];
}
/**
 * An effect or a bound is only ever put into words for a comparison that
 * separated, meaning its interval excludes zero. A magnitude that rounds to 0.0
 * therefore has to read as small rather than as nothing. Printing
 * [-0.044, -0.016] as "between 0.0 and 0.0 better" denies the very evidence the
 * claim was shown for.
 */
const SMALLEST_SHOWN = 0.05;
const size = (value: number) => Math.abs(value).toFixed(1);
const tooSmallToShow = (value: number) => Math.abs(value) < SMALLEST_SHOWN;

/**
 * Only call this for an effect from a separated comparison. A tiny effect can
 * still be supported by a large history, so it keeps its direction: calling a
 * 0.04 gap "about the same" contradicts the range printed directly beneath it.
 */
export function effectWords(effect: number): string {
  const direction = effect < 0 ? "better" : "worse";
  return tooSmallToShow(effect)
    ? `less than 0.1 ${direction}`
    : `${size(effect)} ${direction}`;
}

export function rangeWords(low: number, high: number): string {
  const direction = (value: number) => (value < 0 ? "better" : "worse");
  const [from, to] = low <= high ? [low, high] : [high, low];

  if (direction(from) === direction(to)) {
    // Both bounds point the same way, so read the magnitudes in ascending
    // order. Sorting by signed value would read "between 2.4 and 0.6 better".
    const [near, far] =
      Math.abs(from) <= Math.abs(to) ? [from, to] : [to, from];
    if (tooSmallToShow(far)) {
      return `Less than 0.1 ${direction(near)}.`;
    }
    if (tooSmallToShow(near)) {
      return `Somewhere between less than 0.1 and ${size(far)} ${direction(near)}.`;
    }
    return `Somewhere between ${size(near)} and ${size(far)} ${direction(near)}.`;
  }

  return `Somewhere between ${size(from)} ${direction(from)} and ${size(to)} ${direction(to)}.`;
}
/**
 * Time slots holding enough entries to compare against the rest of the period.
 *
 * The caller needs this count before any slot is tested, because the threshold
 * each slot faces depends on how many comparisons the analysis runs in total.
 */
export function comparableSlots(
  cells: RhythmCell[],
): (RhythmCell & { mean: number })[] {
  const overall = mergeGroups(cells.map((cell) => cell.stats));
  return cells.filter((cell): cell is RhythmCell & { mean: number } => {
    if (cell.mean === null || cell.stats.count < MIN_GROUP_SIZE) {
      return false;
    }
    return subtractGroup(overall, cell.stats).count >= MIN_GROUP_SIZE;
  });
}
export function findings(
  analysis: DriverAnalysis,
  cells: RhythmCell[],
  entryCount: number,
  /**
   * Comparisons the same analysis runs outside the time slots, meaning the
   * driver groups. Zero is only correct when the slots are the whole analysis.
   */
  otherComparisons = 0,
): Finding[] {
  // A candidate carries the groups it came from rather than a range. The range
  // is drawn after ranking, so only the claims that reach the screen pay for
  // the CDF inversion. A large imported history can produce tens of thousands
  // of candidates and still show four.
  type Candidate = Omit<Finding, "range"> & {
    source: [GroupStats, GroupStats];
  };
  const claims: Candidate[] = analysis.drivers.map((d) => ({
    id: d.id,
    text: `Entries ${d.kind === "context" ? "tagged" : "with"} ${d.name} average ${effectWords(d.effect)} than entries without.`,
    sample: `${d.withCount} with · ${d.withoutCount} without`,
    effect: d.effect,
    means: [d.withMean, d.withoutMean],
    source: [d.stats, d.rest],
  }));
  const overall = mergeGroups(cells.map((cell) => cell.stats));
  const slots = comparableSlots(cells);
  const comparisons = slots.length + otherComparisons;
  let inconclusiveSlots = 0;
  for (const cell of slots) {
    const rest = subtractGroup(overall, cell.stats);
    const comparison = compareGroups(cell.stats, rest, comparisons);
    if (!comparison.separated) {
      inconclusiveSlots += 1;
      continue;
    }
    claims.push({
      id: `rhythm:${cell.weekday}:${cell.daypart}`,
      text: `${WEEKDAYS[cell.weekday]} ${DAYPARTS[cell.daypart].toLowerCase()} entries average ${effectWords(comparison.effect)} than the rest of this period.`,
      sample: `${cell.stats.count} in this time slot · ${rest.count} other entries`,
      effect: comparison.effect,
      means: [cell.mean, rest.sum / rest.count],
      source: [cell.stats, rest],
    });
  }
  claims.sort(
    (a, b) =>
      Math.abs(b.effect ?? 0) - Math.abs(a.effect ?? 0) ||
      a.id.localeCompare(b.id),
  );
  const result: Finding[] = claims
    .slice(0, 4)
    .map(({ source, ...finding }) => ({
      ...finding,
      range: confidenceInterval(source[0], source[1], comparisons),
    }));
  if (!result.length || analysis.shortfalls.length) {
    result.push(
      explainSilence(analysis, entryCount, inconclusiveSlots, result.length),
    );
  }
  return result;
}

/**
 * Two reasons produce no claim, and they need different answers. Too few
 * entries is something the user can fix by logging more. A group that was
 * measured and did not separate is already answered, so promising more data
 * would be misleading.
 *
 * The second message says only that the group did not stand apart. It must not
 * name a cause: a group whose entries are all identical to the rest fails to
 * separate exactly as a wildly scattered group does, and telling the first user
 * their entries "vary too much" is false.
 */
function explainSilence(
  analysis: DriverAnalysis,
  entryCount: number,
  inconclusiveSlots: number,
  claimCount: number,
): Finding {
  const shortfall = analysis.shortfalls[0];
  const overlapping = analysis.inconclusive.length + inconclusiveSlots;
  const sample = `${entryCount} entries in this period`;

  if (shortfall) {
    return {
      id: "insufficient",
      effect: null,
      text: `Not enough data yet for ${shortfall.name}. Add ${shortfall.withMissing} more entries with it and ${shortfall.withoutMissing} without it to compare.`,
      sample,
    };
  }

  if (overlapping > 0 && claimCount === 0) {
    return {
      id: "inconclusive",
      effect: null,
      text: `No clear pattern yet. ${overlapping === 1 ? "One group does not stand" : `${overlapping} groups do not stand`} apart from the rest of your entries.`,
      sample,
    };
  }

  return {
    id: "insufficient",
    effect: null,
    text: `Not enough data yet for a pattern. A comparison needs at least ${MIN_GROUP_SIZE} entries in each group. Add tags or emotions as you log.`,
    sample,
  };
}
