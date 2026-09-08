import { startOfDay, subDays } from "date-fns";
import type { MoodEntry } from "@db/types";
import { dailySeries } from "./dailySeries";
import { drivers } from "./drivers";
import { rhythm } from "./rhythm";
import { findings } from "./findings";
export type AnalysisRange = "7" | "30" | "90" | "all";
export function analysisStart(
  range: AnalysisRange,
  now: Date,
  oldestTimestamp?: number | null,
): Date {
  return range === "all"
    ? startOfDay(
        new Date(Math.min(oldestTimestamp ?? now.getTime(), now.getTime())),
      )
    : startOfDay(subDays(now, Number(range) - 1));
}
export function analyzeMoods(entries: MoodEntry[], start: Date, end: Date) {
  const driverAnalysis = drivers(entries);
  const cells = rhythm(entries);
  return {
    dailySeries: dailySeries(entries, start, end),
    rhythm: cells,
    drivers: driverAnalysis.drivers,
    findings: findings(driverAnalysis, cells, entries.length),
  };
}
export type MoodAnalysis = ReturnType<typeof analyzeMoods>;
