/**
 * Mood chart data processing
 *
 * Pure functions that aggregate MoodEntry arrays into the daily and weekly
 * data-point shapes consumed by charts and the analytics service. No React
 * imports — every function is testable with plain Vitest.
 */

import {
  format,
  startOfDay,
  addDays,
  isBefore,
  isEqual,
  startOfWeek,
  subDays,
} from "date-fns";
import type { MoodEntry } from "@db/types";
import { moodScale } from "@/constants/moodScale";

/** Daily aggregate data point for charts */
export interface DailyDataPoint {
  date: Date;
  moods: number[] | null;
  avg?: number;
  min?: number;
  max?: number;
  finalAvg: number;
  hasRealData: boolean;
  isInterpolated: boolean;
}

/** Weekly aggregate data point for charts */
export interface WeeklyDataPoint {
  weekStart: Date;
  moods: number[];
  q1: number;
  q2: number; // median
  q3: number;
  min: number;
  max: number;
  outliers: number[];
  avg: number;
  finalAvg: number;
  isInterpolated: boolean;
}

/** Returns every calendar day between start and end (inclusive). */
export const getDaysInRange = (start: Date, end: Date): Date[] => {
  const days: Date[] = [];
  let currentDate = startOfDay(start);
  const finalDate = startOfDay(end);

  while (isBefore(currentDate, finalDate) || isEqual(currentDate, finalDate)) {
    days.push(new Date(currentDate));
    currentDate = addDays(currentDate, 1);
  }
  return days;
};

/**
 * Down-samples a timestamped array to at most maxPoints entries, always
 * preserving the first and last points.
 */
export const sampleDataPoints = <T extends { timestamp: number }>(
  data: T[],
  maxPoints: number = 200
): T[] => {
  if (data.length <= maxPoints) {
    return data;
  }

  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const step = sorted.length / maxPoints;
  const sampled: T[] = [sorted[0]];

  for (let i = 1; i < maxPoints - 1; i++) {
    const index = Math.round(i * step);
    if (index < sorted.length) {
      sampled.push(sorted[index]);
    }
  }

  if (sorted.length > 1) {
    sampled.push(sorted[sorted.length - 1]);
  }

  return sampled;
};

/** Computes quartiles and outliers (1.5×IQR rule) for a numeric array. */
const getQuartiles = (arr: number[]) => {
  const sorted = [...arr].sort((a, b) => a - b);
  const q1Idx = Math.floor(sorted.length * 0.25);
  const q2Idx = Math.floor(sorted.length * 0.5);
  const q3Idx = Math.floor(sorted.length * 0.75);
  const iqr = sorted[q3Idx] - sorted[q1Idx];

  return {
    q1: sorted[q1Idx],
    q2: sorted[q2Idx],
    q3: sorted[q3Idx],
    min: sorted[0],
    max: sorted[sorted.length - 1],
    outliers: sorted.filter(
      (v) => v < sorted[q1Idx] - 1.5 * iqr || v > sorted[q3Idx] + 1.5 * iqr
    ),
  };
};

/**
 * Aggregates Mood Entries into per-day averages over a rolling window, filling
 * gaps with linear interpolation between neighbouring real days.
 */
export const processMoodDataForDailyChart = (
  allMoods: MoodEntry[],
  numDays?: number
): { labels: string[]; dailyAggregates: DailyDataPoint[] } => {
  if (!allMoods || allMoods.length === 0) {
    return { labels: [], dailyAggregates: [] };
  }

  const maxDays = numDays || 90;
  const sortedMoods = [...allMoods].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const mostRecentDate = startOfDay(
    new Date(sortedMoods[sortedMoods.length - 1].timestamp)
  );
  const cutoffDate = startOfDay(subDays(mostRecentDate, maxDays - 1));

  const filteredMoods = sortedMoods.filter(
    (mood) => startOfDay(new Date(mood.timestamp)) >= cutoffDate
  );

  if (filteredMoods.length === 0) {
    return { labels: [], dailyAggregates: [] };
  }

  const latestDate = startOfDay(
    new Date(filteredMoods[filteredMoods.length - 1].timestamp)
  );
  const earliestDate = startOfDay(new Date(filteredMoods[0].timestamp));

  const allDatesInRange = getDaysInRange(earliestDate, latestDate);

  const moodsByDay: Record<string, number[]> = {};
  filteredMoods.forEach((mood) => {
    const dayKey = format(startOfDay(new Date(mood.timestamp)), "yyyy-MM-dd");
    if (!moodsByDay[dayKey]) {
      moodsByDay[dayKey] = [];
    }
    moodsByDay[dayKey].push(mood.mood);
  });

  type WorkingAggregate = {
    date: Date;
    moods: number[] | null;
    avg?: number;
    min?: number;
    max?: number;
  };

  const initialAggregates: WorkingAggregate[] = allDatesInRange.map((date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const dayMoods = moodsByDay[dateKey] || null;

    if (dayMoods && dayMoods.length > 0) {
      const avg = dayMoods.reduce((sum, val) => sum + val, 0) / dayMoods.length;
      return {
        date,
        moods: dayMoods,
        avg,
        min: Math.min(...dayMoods),
        max: Math.max(...dayMoods),
      };
    }
    return { date, moods: null };
  });

  const finalAggregates: DailyDataPoint[] = initialAggregates.map(
    (aggregate, index) => {
      if (aggregate.avg !== undefined) {
        return {
          ...aggregate,
          finalAvg: aggregate.avg,
          hasRealData: true,
          isInterpolated: false,
        };
      }

      // Find nearest real neighbours for linear interpolation
      let prevIndex = -1;
      for (let i = index - 1; i >= 0; i--) {
        if (initialAggregates[i].avg !== undefined) {
          prevIndex = i;
          break;
        }
      }

      let nextIndex = -1;
      for (let i = index + 1; i < initialAggregates.length; i++) {
        if (initialAggregates[i].avg !== undefined) {
          nextIndex = i;
          break;
        }
      }

      const prevAgg = prevIndex !== -1 ? initialAggregates[prevIndex] : null;
      const nextAgg = nextIndex !== -1 ? initialAggregates[nextIndex] : null;

      let interpolatedAvg: number;

      if (
        prevAgg?.avg !== undefined &&
        nextAgg?.avg !== undefined
      ) {
        const x0 = prevAgg.date.getTime();
        const y0 = prevAgg.avg;
        const x1 = nextAgg.date.getTime();
        const y1 = nextAgg.avg;
        const x = aggregate.date.getTime();
        interpolatedAvg =
          x1 === x0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      } else if (prevAgg?.avg !== undefined) {
        interpolatedAvg = prevAgg.avg;
      } else if (nextAgg?.avg !== undefined) {
        interpolatedAvg = nextAgg.avg;
      } else {
        const neutralMood = moodScale.find((s) => s.label === "Neutral");
        interpolatedAvg = neutralMood ? neutralMood.value : 5;
      }

      return {
        ...aggregate,
        finalAvg: interpolatedAvg,
        hasRealData: false,
        isInterpolated: true,
      };
    }
  );

  const labels = finalAggregates.map((agg) => format(agg.date, "d"));
  return { labels, dailyAggregates: finalAggregates };
};

/**
 * Aggregates Mood Entries into per-week box-plot statistics (median, IQR,
 * outliers) over a rolling window of maxWeeks weeks.
 */
export const processWeeklyMoodData = (
  allMoods: MoodEntry[],
  maxWeeks: number = 52,
  referenceDate: Date = new Date()
): { labels: string[]; weeklyAggregates: WeeklyDataPoint[] } => {
  if (!allMoods || allMoods.length === 0) {
    return { labels: [], weeklyAggregates: [] };
  }

  const sortedMoods = [...allMoods].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const cutoffDate = subDays(referenceDate, maxWeeks * 7);
  const filteredMoods = sortedMoods.filter(
    (mood) => new Date(mood.timestamp) >= cutoffDate
  );

  const moodsByWeek: Record<string, number[]> = {};
  filteredMoods.forEach((mood) => {
    const weekStart = startOfWeek(new Date(mood.timestamp), {
      weekStartsOn: 1,
    });
    const weekKey = format(weekStart, "yyyy-MM-dd");
    if (!moodsByWeek[weekKey]) {
      moodsByWeek[weekKey] = [];
    }
    moodsByWeek[weekKey].push(mood.mood);
  });

  const weekKeys = Object.keys(moodsByWeek).sort().reverse();
  const weeklyAggregates: WeeklyDataPoint[] = weekKeys.map((weekKey) => {
    const weekMoods = moodsByWeek[weekKey];
    const stats = getQuartiles(weekMoods);
    const avg = weekMoods.reduce((sum, val) => sum + val, 0) / weekMoods.length;

    return {
      weekStart: new Date(weekKey),
      moods: weekMoods,
      ...stats,
      avg,
      finalAvg: stats.q2, // use median as the representative value
      isInterpolated: false,
    };
  });

  return {
    labels: weeklyAggregates.map((week) =>
      format(week.weekStart, "'W'w MMM")
    ),
    weeklyAggregates,
  };
};
