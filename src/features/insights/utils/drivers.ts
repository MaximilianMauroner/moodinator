import type { MoodEntry } from "@db/types";
import { getInterpretedMoodRating } from "@/constants/moodScaleInterpretation";
import {
  addToGroup,
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
}

interface LabelGroup {
  name: string;
  kind: Driver["kind"];
  stats: GroupStats;
}

/** Descriptive averages for labels with enough entries on both sides. */
export function drivers(entries: MoodEntry[]): Driver[] {
  const groups = new Map<string, LabelGroup>();
  const overall = emptyGroup();
  for (const entry of entries) {
    const value = getInterpretedMoodRating(entry);
    addToGroup(overall, value);
    const labels: { name: string; kind: Driver["kind"] }[] = [
      ...new Set(entry.contextTags),
    ].map((name) => ({ name, kind: "context" as const }));
    labels.push(
      ...[...new Set(entry.emotions.map((emotion) => emotion.name))].map(
        (name) => ({ name, kind: "emotion" as const }),
      ),
    );
    for (const { name, kind } of labels) {
      const id = `${kind}:${name}`;
      const group = groups.get(id) ?? { name, kind, stats: emptyGroup() };
      addToGroup(group.stats, value);
      groups.set(id, group);
    }
  }

  const comparisons: Driver[] = [];
  for (const [id, group] of groups) {
    const rest = subtractGroup(overall, group.stats);
    if (group.stats.count < MIN_GROUP_SIZE || rest.count < MIN_GROUP_SIZE) {
      continue;
    }
    comparisons.push({
      id,
      name: group.name,
      kind: group.kind,
      withCount: group.stats.count,
      withoutCount: rest.count,
      withMean: groupMean(group.stats),
      withoutMean: groupMean(rest),
    });
  }
  // Frequency is a useful, neutral order; sorting by the largest difference
  // would elevate the noisiest comparison in a large imported history.
  comparisons.sort(
    (a, b) => b.withCount - a.withCount || a.id.localeCompare(b.id),
  );
  return comparisons;
}
