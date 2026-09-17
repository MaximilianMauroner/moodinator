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
  ciLow: number;
  ciHigh: number;
}
export interface DriverAnalysis {
  drivers: Driver[];
  /** Too few entries on one side to compare at all. */
  shortfalls: { name: string; withMissing: number; withoutMissing: number }[];
  /** Enough entries, but the groups overlap too much to claim a difference. */
  inconclusive: { name: string }[];
}
export function drivers(entries: MoodEntry[]): DriverAnalysis {
  const groups = new Map<
    string,
    { name: string; kind: Driver["kind"]; stats: GroupStats }
  >();
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
    const comparison = compareGroups(group.stats, rest);
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
      ciLow: comparison.ciLow,
      ciHigh: comparison.ciHigh,
    });
  }
  result.drivers.sort(
    (a, b) =>
      Math.abs(b.effect) - Math.abs(a.effect) || a.id.localeCompare(b.id),
  );
  return result;
}
