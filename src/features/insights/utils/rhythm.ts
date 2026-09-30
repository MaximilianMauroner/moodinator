import {
  getEntryLocalHour,
  getEntryLocalWeekday,
  hasKnownDate,
} from "@/lib/entryTimezone";
import type { MoodEntry } from "@db/types";
import { getInterpretedMoodRating } from "@/constants/moodScaleInterpretation";
import { getMoodHex } from "@/lib/moodPresentation";
import { getThemedColor } from "@/constants/colors";
import { addToGroup, emptyGroup, groupMean, mergeGroups, type GroupStats } from "./statistics";
export const DAYPARTS = ["Morning", "Midday", "Evening", "Night"] as const;
export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
export interface RhythmCell {
  weekday: number;
  daypart: number;
  count: number;
  mean: number | null;
  /** Recorded count and sum for this time slot. */
  stats: GroupStats;
}
export function rhythm(entries: MoodEntry[]): RhythmCell[] {
  const cells = Array.from({ length: 28 }, (_, i) => ({
    weekday: i % 7,
    daypart: Math.floor(i / 7),
    stats: emptyGroup(),
  }));
  for (const entry of entries) {
    // The epoch sentinel is not a real Thursday night, so it is not counted as
    // one. Drivers still use the row, because they compare labels, not dates.
    if (!hasKnownDate(entry)) {
      continue;
    }
    const hour = getEntryLocalHour(entry);
    const weekday = getEntryLocalWeekday(entry);
    if (hour === null || weekday === null) continue;
    const part = hour < 12 ? 0 : hour < 17 ? 1 : hour < 22 ? 2 : 3;
    const cell = cells[part * 7 + ((weekday + 6) % 7)];
    addToGroup(cell.stats, getInterpretedMoodRating(entry));
  }
  return cells.map((cell) => ({
    ...cell,
    count: cell.stats.count,
    mean: cell.stats.count ? groupMean(cell.stats) : null,
  }));
}
export interface DaypartMean {
  daypart: (typeof DAYPARTS)[number];
  count: number;
  mean: number | null;
}

/** Mean rating per part of the day across all weekdays. */
export function daypartMeans(cells: RhythmCell[]): DaypartMean[] {
  return DAYPARTS.map((daypart, index) => {
    const merged = mergeGroups(cells.filter((cell) => cell.daypart === index).map((cell) => cell.stats));
    return { daypart, count: merged.count, mean: merged.count ? groupMean(merged) : null };
  });
}

export function rhythmCellColor(cell: RhythmCell, isDark: boolean): string {
  return cell.mean === null
    ? getThemedColor("surfaceAlt", isDark)
    : getMoodHex(cell.mean, isDark);
}
