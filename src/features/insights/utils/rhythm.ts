import { getEntryLocalHour, getEntryLocalWeekday } from "@/lib/entryTimezone";
import type { MoodEntry } from "@db/types";
import { getInterpretedMoodRating } from "@/constants/moodScaleInterpretation";
import { getMoodHex } from "@/lib/moodPresentation";
import { getThemedColor } from "@/constants/colors";
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
}
export function rhythm(entries: MoodEntry[]): RhythmCell[] {
  const cells = Array.from({ length: 28 }, (_, i) => ({
    weekday: i % 7,
    daypart: Math.floor(i / 7),
    count: 0,
    total: 0,
  }));
  for (const entry of entries) {
    const hour = getEntryLocalHour(entry);
    const part = hour < 12 ? 0 : hour < 17 ? 1 : hour < 22 ? 2 : 3;
    const cell = cells[part * 7 + ((getEntryLocalWeekday(entry) + 6) % 7)];
    cell.count++;
    cell.total += getInterpretedMoodRating(entry);
  }
  return cells.map(({ total, ...cell }) => ({
    ...cell,
    mean: cell.count ? total / cell.count : null,
  }));
}
export function rhythmCellColor(cell: RhythmCell, isDark: boolean): string {
  return cell.mean === null
    ? getThemedColor("surfaceAlt", isDark)
    : getMoodHex(cell.mean, isDark);
}
