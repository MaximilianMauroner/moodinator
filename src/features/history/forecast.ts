import type { MoodEntry } from "@db/types";
import { getInterpretedMoodRating } from "@/constants/moodScaleInterpretation";
import { getEntryLocalDayKey } from "@/lib/entryTimezone";

export type ForecastDay = {
  /** Local calendar day, YYYY-MM-DD, as recorded on each entry. */
  dayKey: string;
  date: Date;
  /** Entries of the day, oldest first. */
  entries: MoodEntry[];
  lightest: number | null;
  heaviest: number | null;
  average: number | null;
};

function dayKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Groups entries into the last `days` calendar days, newest day first, for
 * the forecast view. Lower ratings are lighter, so `lightest` is the minimum.
 */
export function buildForecastDays(entries: MoodEntry[], today: Date, days = 7): ForecastDay[] {
  const byDay = new Map<string, MoodEntry[]>();
  for (const entry of entries) {
    const key = getEntryLocalDayKey(entry);
    if (!key) continue;
    const list = byDay.get(key);
    if (list) list.push(entry);
    else byDay.set(key, [entry]);
  }

  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const dayKey = dayKeyOf(date);
    const dayEntries = [...(byDay.get(dayKey) ?? [])].sort((a, b) => a.timestamp - b.timestamp);
    const ratings = dayEntries.map(getInterpretedMoodRating);
    return {
      dayKey,
      date,
      entries: dayEntries,
      lightest: ratings.length ? Math.min(...ratings) : null,
      heaviest: ratings.length ? Math.max(...ratings) : null,
      average: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null,
    };
  });
}
