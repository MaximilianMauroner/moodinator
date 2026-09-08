import type { DriverAnalysis } from "./drivers";
import type { RhythmCell } from "./rhythm";
import { DAYPARTS, WEEKDAYS } from "./rhythm";
export interface Finding {
  id: string;
  text: string;
  sample: string;
  effect: number | null;
  means?: [number, number];
}
export function effectWords(effect: number): string {
  return Math.abs(effect) < 0.05
    ? "about the same"
    : `${Math.abs(effect).toFixed(1)} ${effect < 0 ? "better" : "worse"}`;
}
export function findings(
  analysis: DriverAnalysis,
  cells: RhythmCell[],
  entryCount: number,
): Finding[] {
  const claims: Finding[] = analysis.drivers.map((d) => ({
    id: d.id,
    text: `Entries ${d.kind === "context" ? "tagged" : "with"} ${d.name} average ${effectWords(d.effect)} ${Math.abs(d.effect) < 0.05 ? "as" : "than"} entries without.`,
    sample: `${d.withCount} with · ${d.withoutCount} without`,
    effect: d.effect,
    means: [d.withMean, d.withoutMean],
  }));
  const total = cells.reduce((sum, c) => sum + (c.mean ?? 0) * c.count, 0);
  for (const cell of cells) {
    const rest = entryCount - cell.count;
    if (cell.count < 5 || rest < 5 || cell.mean === null) continue;
    const otherMean = (total - cell.mean * cell.count) / rest;
    const effect = cell.mean - otherMean;
    claims.push({
      id: `rhythm:${cell.weekday}:${cell.daypart}`,
      text: `${WEEKDAYS[cell.weekday]} ${DAYPARTS[cell.daypart].toLowerCase()} entries average ${effectWords(effect)} ${Math.abs(effect) < 0.05 ? "as" : "than"} the rest of this period.`,
      sample: `${cell.count} in this time slot · ${rest} other entries`,
      effect,
      means: [cell.mean, otherMean],
    });
  }
  claims.sort(
    (a, b) =>
      Math.abs(b.effect ?? 0) - Math.abs(a.effect ?? 0) ||
      a.id.localeCompare(b.id),
  );
  const result = claims.slice(0, 4);
  if (!result.length || analysis.shortfalls.length) {
    const shortfall = analysis.shortfalls[0];
    result.push({
      id: "insufficient",
      effect: null,
      text:
        "Not enough data yet for " +
        (shortfall
          ? `${shortfall.name}. Add ${shortfall.withMissing} more entries with it and ${shortfall.withoutMissing} without it to compare.`
          : "a pattern. A comparison needs at least 5 entries in each group. Add tags or emotions as you log."),
      sample: `${entryCount} entries in this period`,
    });
  }
  return result;
}
