import type { MoodEntry } from "@db/types";
import { getInterpretedMoodRating } from "@/constants/moodScaleInterpretation";
import {
  addToGroup,
  compareGroups,
  emptyGroup,
  groupMean,
  subtractGroup,
  type GroupStats,
} from "./statistics";

export const MIN_GROUP_SIZE = 5;

export interface Driver {
  id: string;
  name: string;
  kind: "context" | "emotion";
  withCount: number;
  withoutCount: number;
  withMean: number;
  withoutMean: number;
  effect: number;
  /**
   * The two groups the effect came from, kept so the interval can be drawn
   * later. Only the handful of claims that reach the screen need one, and
   * producing it is two orders of magnitude dearer than the comparison.
   */
  stats: GroupStats;
  rest: GroupStats;
}
export interface DriverAnalysis {
  drivers: Driver[];
  /** Too few entries on one side to compare at all. */
  shortfalls: { name: string; withMissing: number; withoutMissing: number }[];
  /** Enough entries, but the comparison does not separate it from the rest. */
  inconclusive: { name: string }[];
}
interface LabelGroup {
  name: string;
  kind: Driver["kind"];
  stats: GroupStats;
}
export function drivers(
  entries: MoodEntry[],
  /**
   * Comparisons the same analysis runs outside this function, such as the time
   * slots. Every comparison in one analysis shares one confidence level, so
   * each half has to know the size of the other. Zero is only correct when
   * drivers are the whole analysis.
   */
  otherComparisons = 0
): DriverAnalysis {
  const groups = new Map<string, LabelGroup>();
  const overall = emptyGroup();
  for (const entry of entries) {
    const value = getInterpretedMoodRating(entry);
    addToGroup(overall, value);
    const labels: { name: string; kind: Driver["kind"] }[] = [
      ...new Set(entry.contextTags),
    ].map((name) => ({ name, kind: "context" as const }));
    labels.push(
      ...[...new Set(entry.emotions.map((e) => e.name))].map((name) => ({
        name,
        kind: "emotion" as const,
      })),
    );
    for (const { name, kind } of labels) {
      const id = `${kind}:${name}`;
      const group = groups.get(id) ?? { name, kind, stats: emptyGroup() };
      addToGroup(group.stats, value);
      groups.set(id, group);
    }
  }
  const result: DriverAnalysis = {
    drivers: [],
    shortfalls: [],
    inconclusive: [],
  };
  // Which groups are large enough is settled before any of them is tested,
  // because the threshold each one faces depends on how many there are.
  const comparable: { id: string; group: LabelGroup; rest: GroupStats }[] = [];
  for (const [id, group] of groups) {
    const rest = subtractGroup(overall, group.stats);
    if (group.stats.count < MIN_GROUP_SIZE || rest.count < MIN_GROUP_SIZE) {
      result.shortfalls.push({
        name: group.name,
        withMissing: Math.max(0, MIN_GROUP_SIZE - group.stats.count),
        withoutMissing: Math.max(0, MIN_GROUP_SIZE - rest.count),
      });
      continue;
    }
    comparable.push({ id, group, rest });
  }
  const comparisons = comparable.length + otherComparisons;
  for (const { id, group, rest } of comparable) {
    const comparison = compareGroups(group.stats, rest, comparisons);
    if (!comparison.separated) {
      // Enough entries to look, not enough separation to say anything.
      result.inconclusive.push({ name: group.name });
      continue;
    }
    result.drivers.push({
      id,
      name: group.name,
      kind: group.kind,
      withCount: group.stats.count,
      withoutCount: rest.count,
      withMean: groupMean(group.stats),
      withoutMean: groupMean(rest),
      effect: comparison.effect,
      stats: group.stats,
      rest,
    });
  }
  result.drivers.sort(
    (a, b) =>
      Math.abs(b.effect) - Math.abs(a.effect) || a.id.localeCompare(b.id),
  );
  return result;
}
