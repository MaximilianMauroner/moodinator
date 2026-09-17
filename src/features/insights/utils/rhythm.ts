import {
  getEntryLocalHour,
  getEntryLocalWeekday,
  hasKnownDate,
} from "@/lib/entryTimezone";
import type { MoodEntry } from "@db/types";
import { getInterpretedMoodRating } from "@/constants/moodScaleInterpretation";
import { getMoodHex } from "@/lib/moodPresentation";
import { getThemedColor } from "@/constants/colors";
import { addToGroup, emptyGroup, groupMean, type GroupStats } from "./statistics";
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
  /** Second moment, so a cell can be compared against the rest with a spread. */
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
    const part = hour < 12 ? 0 : hour < 17 ? 1 : hour < 22 ? 2 : 3;
    const cell = cells[part * 7 + ((getEntryLocalWeekday(entry) + 6) % 7)];
    addToGroup(cell.stats, getInterpretedMoodRating(entry));
  }
  return cells.map((cell) => ({
    ...cell,
    count: cell.stats.count,
    mean: cell.stats.count ? groupMean(cell.stats) : null,
  }));
}
export function rhythmCellColor(cell: RhythmCell, isDark: boolean): string {
  return cell.mean === null
    ? getThemedColor("surfaceAlt", isDark)
    : getMoodHex(cell.mean, isDark);
}
