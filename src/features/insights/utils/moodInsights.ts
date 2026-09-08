import {
  format,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { getEntryLocalDayKey } from "@/lib/entryTimezone";
import type { MoodEntry } from "@db/types";
import type { TimePeriod } from "../components/TimePeriodSelector";
import { calculatePeriodStats, type PeriodStats } from "./periodStats";

export type MoodInsightsResult = {
  periodMoods: MoodEntry[];
  previousPeriodMoods: MoodEntry[];
  stats: PeriodStats;
};

export function getMoodsInPeriod(
  moods: MoodEntry[],
  period: TimePeriod,
  date: Date,
): MoodEntry[] {
  if (period === "all") return moods;

  let start: Date;
  let end: Date;

  if (period === "week") {
    start = startOfWeek(date, { weekStartsOn: 1 });
    end = endOfWeek(date, { weekStartsOn: 1 });
  } else if (period === "month") {
    start = startOfMonth(date);
    end = endOfMonth(date);
  } else {
    return moods;
  }

  return moods.filter((mood) => {
    const day = getEntryLocalDayKey(mood);
    return (
      day >= format(start, "yyyy-MM-dd") && day <= format(end, "yyyy-MM-dd")
    );
  });
}

export function getPreviousPeriodDate(period: TimePeriod, date: Date): Date {
  if (period === "week") {
    return subWeeks(date, 1);
  }
  if (period === "month") {
    return subMonths(date, 1);
  }
  return date;
}

export function getNextPeriodDate(period: TimePeriod, date: Date): Date {
  if (period === "week") {
    return addWeeks(date, 1);
  }
  if (period === "month") {
    return addMonths(date, 1);
  }
  return date;
}

export function buildMoodInsights(
  allMoods: MoodEntry[],
  period: TimePeriod,
  currentDate: Date,
): MoodInsightsResult {
  const periodMoods = getMoodsInPeriod(allMoods, period, currentDate);
  const previousPeriodMoods =
    period === "all"
      ? []
      : getMoodsInPeriod(
          allMoods,
          period,
          getPreviousPeriodDate(period, currentDate),
        );

  return {
    periodMoods,
    previousPeriodMoods,
    stats: calculatePeriodStats(periodMoods, previousPeriodMoods),
  };
}
