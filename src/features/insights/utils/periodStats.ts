import { format } from "date-fns";
import type { MoodEntry } from "@db/types";
import {
  getMoodTrendDirection,
  getNeutralMoodRating,
  getInterpretedMoodRating,
  sortMoodRatingsBestFirst,
  type MoodTrendDirection,
} from "@/constants/moodScaleInterpretation";

export interface PeriodStats {
  entryCount: number;
  averageMood: number;
  moodChange: number;
  trendDirection: MoodTrendDirection;
  bestDay: string | null;
  worstDay: string | null;
  mostCommonMood: number;
  energyAvg: number | null;
}

export function calculatePeriodStats(
  currentMoods: MoodEntry[],
  previousMoods: MoodEntry[]
): PeriodStats {
  const entryCount = currentMoods.length;
  const neutralMoodRating = getNeutralMoodRating();

  if (entryCount === 0) {
    return {
      entryCount: 0,
      averageMood: neutralMoodRating,
      moodChange: 0,
      trendDirection: "stable",
      bestDay: null,
      worstDay: null,
      mostCommonMood: neutralMoodRating,
      energyAvg: null,
    };
  }

  const interpretedCurrentMoods = currentMoods.map((mood) =>
    getInterpretedMoodRating(mood)
  );
  const totalMood = interpretedCurrentMoods.reduce((sum, mood) => sum + mood, 0);
  const averageMood = totalMood / entryCount;

  let moodChange = 0;
  if (previousMoods.length > 0) {
    const interpretedPreviousMoods = previousMoods.map((mood) =>
      getInterpretedMoodRating(mood)
    );
    const previousAverage =
      interpretedPreviousMoods.reduce((sum, mood) => sum + mood, 0) /
      interpretedPreviousMoods.length;
    moodChange = averageMood - previousAverage;
  }

  const moodsByDay: Record<string, { total: number; count: number }> = {};
  currentMoods.forEach((mood) => {
    const dayKey = format(new Date(mood.timestamp), "EEEE");
    if (!moodsByDay[dayKey]) {
      moodsByDay[dayKey] = { total: 0, count: 0 };
    }
    moodsByDay[dayKey].total += getInterpretedMoodRating(mood);
    moodsByDay[dayKey].count++;
  });

  const dayAverages = Object.entries(moodsByDay)
    .map(([day, data]) => ({ day, avg: data.total / data.count }))
    .sort((a, b) => sortMoodRatingsBestFirst(a.avg, b.avg));

  const moodCounts: Record<number, number> = {};
  currentMoods.forEach((mood) => {
    const interpretedMood = Math.round(getInterpretedMoodRating(mood));
    moodCounts[interpretedMood] = (moodCounts[interpretedMood] || 0) + 1;
  });

  const mostCommonMood = Object.entries(moodCounts).sort(
    (a, b) =>
      b[1] - a[1] || sortMoodRatingsBestFirst(Number(a[0]), Number(b[0]))
  )[0]?.[0];

  const moodsWithEnergy = currentMoods.filter(
    (mood) => mood.energy !== undefined && mood.energy !== null
  );
  const energyAvg =
    moodsWithEnergy.length > 0
      ? moodsWithEnergy.reduce((sum, mood) => sum + (mood.energy || 0), 0) /
        moodsWithEnergy.length
      : null;

  return {
    entryCount,
    averageMood: Math.round(averageMood * 10) / 10,
    moodChange: Math.round(moodChange * 10) / 10,
    trendDirection: getMoodTrendDirection(moodChange),
    bestDay: dayAverages.length > 0 ? dayAverages[0].day : null,
    worstDay:
      dayAverages.length > 0 ? dayAverages[dayAverages.length - 1].day : null,
    mostCommonMood: parseInt(mostCommonMood ?? String(neutralMoodRating), 10),
    energyAvg: energyAvg !== null ? Math.round(energyAvg * 10) / 10 : null,
  };
}
