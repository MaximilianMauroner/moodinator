import type { MoodEntry } from "@db/types";
import { getInterpretedMoodRating } from "@/constants/moodScaleInterpretation";

export interface Driver {
  id: string;
  name: string;
  kind: "context" | "emotion";
  withCount: number;
  withoutCount: number;
  withMean: number;
  withoutMean: number;
  effect: number;
}
export interface DriverAnalysis {
  drivers: Driver[];
  shortfalls: { name: string; withMissing: number; withoutMissing: number }[];
}
export function drivers(entries: MoodEntry[]): DriverAnalysis {
  const groups = new Map<
    string,
    { name: string; kind: Driver["kind"]; sum: number; count: number }
  >();
  let total = 0;
  for (const entry of entries) {
    const value = getInterpretedMoodRating(entry);
    total += value;
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
      const group = groups.get(id) ?? { name, kind, sum: 0, count: 0 };
      group.sum += value;
      group.count++;
      groups.set(id, group);
    }
  }
  const result: DriverAnalysis = { drivers: [], shortfalls: [] };
  for (const [id, group] of groups) {
    const withoutCount = entries.length - group.count;
    if (group.count < 5 || withoutCount < 5) {
      result.shortfalls.push({
        name: group.name,
        withMissing: Math.max(0, 5 - group.count),
        withoutMissing: Math.max(0, 5 - withoutCount),
      });
      continue;
    }
    const withMean = group.sum / group.count;
    const withoutMean = (total - group.sum) / withoutCount;
    result.drivers.push({
      id,
      name: group.name,
      kind: group.kind,
      withCount: group.count,
      withoutCount,
      withMean,
      withoutMean,
      effect: withMean - withoutMean,
    });
  }
  result.drivers.sort(
    (a, b) =>
      Math.abs(b.effect) - Math.abs(a.effect) || a.id.localeCompare(b.id),
  );
  return result;
}
