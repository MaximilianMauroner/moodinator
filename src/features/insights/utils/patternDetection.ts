import type { MoodEntry } from "@db/types";
import { format, getHours, getDay, isWeekend } from "date-fns";

export interface Pattern {
  id: string;
  type: "time_of_day" | "day_of_week" | "emotion" | "context" | "weekend";
  title: string;
  description: string;
  confidence: number; // 0-1 scale
  icon: string;
}

interface TimeOfDayStats {
  morning: { total: number; count: number }; // 5-11
  afternoon: { total: number; count: number }; // 12-16
  evening: { total: number; count: number }; // 17-20
  night: { total: number; count: number }; // 21-4
}

interface DayOfWeekStats {
  [key: number]: { total: number; count: number };
}

function getTimeOfDay(hour: number): keyof TimeOfDayStats {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function getTimeOfDayLabel(key: keyof TimeOfDayStats): string {
  const labels = {
    morning: "mornings",
    afternoon: "afternoons",
    evening: "evenings",
    night: "nights",
  };
  return labels[key];
}

function getDayLabel(dayIndex: number): string {
  const days = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  return days[dayIndex];
}

/**
 * Detect time of day patterns
 * Returns pattern if there's a significant difference between best and worst times
 */
function detectTimeOfDayPattern(moods: MoodEntry[]): Pattern | null {
  if (moods.length < 10) return null;

  const stats: TimeOfDayStats = {
    morning: { total: 0, count: 0 },
    afternoon: { total: 0, count: 0 },
    evening: { total: 0, count: 0 },
    night: { total: 0, count: 0 },
  };

  moods.forEach((mood) => {
    const hour = getHours(new Date(mood.timestamp));
    const period = getTimeOfDay(hour);
    stats[period].total += mood.mood;
    stats[period].count++;
  });

  // Calculate averages for each period
  const averages = Object.entries(stats)
    .filter(([_, data]) => data.count >= 3) // Need at least 3 entries per period
    .map(([period, data]) => ({
      period: period as keyof TimeOfDayStats,
      avg: data.total / data.count,
      count: data.count,
    }))
    .sort((a, b) => a.avg - b.avg); // Lower is better

  if (averages.length < 2) return null;

  const best = averages[0];
  const worst = averages[averages.length - 1];
  const difference = worst.avg - best.avg;

  // Need at least 0.8 difference to be significant
  if (difference < 0.8) return null;

  return {
    id: "time_of_day",
    type: "time_of_day",
    title: "Time of Day",
    description: `You tend to feel best in the ${getTimeOfDayLabel(best.period)}`,
    confidence: Math.min(difference / 2, 1),
    icon: best.period === "morning" ? "sunny-outline" :
          best.period === "afternoon" ? "partly-sunny-outline" :
          best.period === "evening" ? "moon-outline" : "cloudy-night-outline",
  };
}

/**
 * Detect day of week patterns
 */
function detectDayOfWeekPattern(moods: MoodEntry[]): Pattern | null {
  if (moods.length < 14) return null; // Need at least 2 weeks of data

  const stats: DayOfWeekStats = {};
  for (let i = 0; i < 7; i++) {
    stats[i] = { total: 0, count: 0 };
  }

  moods.forEach((mood) => {
    const dayIndex = getDay(new Date(mood.timestamp));
    stats[dayIndex].total += mood.mood;
    stats[dayIndex].count++;
  });

  const averages = Object.entries(stats)
    .filter(([_, data]) => data.count >= 2)
    .map(([day, data]) => ({
      day: parseInt(day, 10),
      avg: data.total / data.count,
      count: data.count,
    }))
    .sort((a, b) => a.avg - b.avg);

  if (averages.length < 3) return null;

  const best = averages[0];
  const worst = averages[averages.length - 1];
  const difference = worst.avg - best.avg;

  if (difference < 0.8) return null;

  return {
    id: "day_of_week",
    type: "day_of_week",
    title: "Best Day",
    description: `${getDayLabel(best.day)} tend to be your best days`,
    confidence: Math.min(difference / 2, 1),
    icon: "calendar-outline",
  };
}

/**
 * Detect weekend vs weekday patterns
 */
function detectWeekendPattern(moods: MoodEntry[]): Pattern | null {
  if (moods.length < 14) return null;

  let weekdayTotal = 0;
  let weekdayCount = 0;
  let weekendTotal = 0;
  let weekendCount = 0;

  moods.forEach((mood) => {
    const date = new Date(mood.timestamp);
    if (isWeekend(date)) {
      weekendTotal += mood.mood;
      weekendCount++;
    } else {
      weekdayTotal += mood.mood;
      weekdayCount++;
    }
  });

  if (weekdayCount < 5 || weekendCount < 2) return null;

  const weekdayAvg = weekdayTotal / weekdayCount;
  const weekendAvg = weekendTotal / weekendCount;
  const difference = Math.abs(weekdayAvg - weekendAvg);

  if (difference < 0.5) return null;

  const isBetterOnWeekends = weekendAvg < weekdayAvg; // Lower is better

  return {
    id: "weekend",
    type: "weekend",
    title: "Weekend Effect",
    description: isBetterOnWeekends
      ? "Your mood tends to be better on weekends"
      : "Your mood tends to be better on weekdays",
    confidence: Math.min(difference / 1.5, 1),
    icon: isBetterOnWeekends ? "sunny-outline" : "briefcase-outline",
  };
}

/**
 * Detect emotion-mood correlations
 */
function detectEmotionPatterns(moods: MoodEntry[]): Pattern | null {
  const emotionStats: Record<string, { total: number; count: number }> = {};

  moods.forEach((mood) => {
    if (mood.emotions && mood.emotions.length > 0) {
      mood.emotions.forEach((emotion) => {
        const name = emotion.name.toLowerCase();
        if (!emotionStats[name]) {
          emotionStats[name] = { total: 0, count: 0 };
        }
        emotionStats[name].total += mood.mood;
        emotionStats[name].count++;
      });
    }
  });

  const sortedEmotions = Object.entries(emotionStats)
    .filter(([_, data]) => data.count >= 3)
    .map(([name, data]) => ({
      name,
      avg: data.total / data.count,
      count: data.count,
    }))
    .sort((a, b) => a.avg - b.avg);

  if (sortedEmotions.length < 2) return null;

  const best = sortedEmotions[0];
  const worst = sortedEmotions[sortedEmotions.length - 1];

  // Capitalize first letter
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return {
    id: "emotion_correlation",
    type: "emotion",
    title: "Emotion Insight",
    description: `When feeling "${capitalize(best.name)}", your mood tends to be better`,
    confidence: Math.min((worst.avg - best.avg) / 2, 1),
    icon: "heart-outline",
  };
}

/**
 * Detect context patterns
 */
function detectContextPatterns(moods: MoodEntry[]): Pattern | null {
  const contextStats: Record<string, { total: number; count: number }> = {};

  moods.forEach((mood) => {
    if (mood.contextTags && mood.contextTags.length > 0) {
      mood.contextTags.forEach((ctx: string) => {
        const name = ctx.toLowerCase();
        if (!contextStats[name]) {
          contextStats[name] = { total: 0, count: 0 };
        }
        contextStats[name].total += mood.mood;
        contextStats[name].count++;
      });
    }
  });

  const sortedContexts = Object.entries(contextStats)
    .filter(([_, data]) => data.count >= 3)
    .map(([name, data]) => ({
      name,
      avg: data.total / data.count,
      count: data.count,
    }))
    .sort((a, b) => a.avg - b.avg);

  if (sortedContexts.length < 2) return null;

  const best = sortedContexts[0];
  const worst = sortedContexts[sortedContexts.length - 1];

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return {
    id: "context_correlation",
    type: "context",
    title: "Context Insight",
    description: `"${capitalize(best.name)}" activities are associated with better moods`,
    confidence: Math.min((worst.avg - best.avg) / 2, 1),
    icon: "location-outline",
  };
}

/**
 * Main function to detect all patterns
 * Returns up to 3 highest confidence patterns
 */
export function detectPatterns(moods: MoodEntry[], maxPatterns = 3): Pattern[] {
  if (moods.length < 7) return [];

  const allPatterns: (Pattern | null)[] = [
    detectTimeOfDayPattern(moods),
    detectDayOfWeekPattern(moods),
    detectWeekendPattern(moods),
    detectEmotionPatterns(moods),
    detectContextPatterns(moods),
  ];

  return allPatterns
    .filter((p): p is Pattern => p !== null && p.confidence >= 0.3)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxPatterns);
}

/**
 * Calculate current streak (consecutive days with entries)
 */
export function calculateStreak(moods: MoodEntry[]): { current: number; longest: number } {
  if (moods.length === 0) return { current: 0, longest: 0 };

  // Sort by timestamp descending
  const sortedMoods = [...moods].sort((a, b) => b.timestamp - a.timestamp);

  // Group by date
  const dateSet = new Set<string>();
  sortedMoods.forEach((mood) => {
    const dateKey = format(new Date(mood.timestamp), "yyyy-MM-dd");
    dateSet.add(dateKey);
  });

  const dates = Array.from(dateSet).sort().reverse(); // Most recent first

  if (dates.length === 0) return { current: 0, longest: 0 };

  // Calculate current streak
  let currentStreak = 0;
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");

  // Current streak must include today or yesterday
  if (dates[0] === today || dates[0] === yesterday) {
    currentStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);
      const diffDays = Math.round((prevDate.getTime() - currDate.getTime()) / 86400000);

      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 1;
  let tempStreak = 1;

  const sortedDatesAsc = [...dates].reverse(); // Oldest first
  for (let i = 1; i < sortedDatesAsc.length; i++) {
    const prevDate = new Date(sortedDatesAsc[i - 1]);
    const currDate = new Date(sortedDatesAsc[i]);
    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / 86400000);

    if (diffDays === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  return { current: currentStreak, longest: longestStreak };
}
