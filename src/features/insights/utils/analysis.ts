import { startOfDay, subDays } from "date-fns";
import type { MoodEntry } from "@db/types";
import { dailySeries } from "./dailySeries";
import { drivers } from "./drivers";
import { rhythm } from "./rhythm";
import { comparableSlots, findings } from "./findings";
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
  const cells = rhythm(entries);
  // Driver groups and time slots are one family of comparisons. Each half is
  // told how many the other runs, so both face the same divided threshold and
  // the analysis as a whole keeps its stated confidence.
  const slotCount = comparableSlots(cells).length;
  const driverAnalysis = drivers(entries, slotCount);
  const driverCount =
    driverAnalysis.drivers.length + driverAnalysis.inconclusive.length;
  return {
    dailySeries: dailySeries(entries, start, end),
    rhythm: cells,
    drivers: driverAnalysis.drivers,
    /**
     * Groups that were large enough to compare and did not separate. The
     * Drivers card needs these to tell "measured, no difference" apart from
     * "not enough entries yet", which look identical in `drivers` alone.
     */
    inconclusiveDrivers: driverAnalysis.inconclusive,
    findings: findings(driverAnalysis, cells, entries.length, driverCount),
  };
}
export type MoodAnalysis = ReturnType<typeof analyzeMoods>;
