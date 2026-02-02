/**
 * Mood Correlation Calculations
 * Computes correlations between moods and various factors
 */

import type { MoodEntry } from "@db/types";
import { getHours, getDay, isWeekend } from "date-fns";

export interface CorrelationResult {
  type: "emotion" | "context" | "time_of_day" | "day_of_week" | "energy";
  label: string;
  avgMood: number;
  delta: number; // Difference from overall average
  count: number;
  icon: string;
  isPositive: boolean; // True if associated with better moods (lower values)
}

export interface CorrelationSummary {
  overallAvg: number;
  totalEntries: number;
  correlations: CorrelationResult[];
  topPositive: CorrelationResult | null; // Best for mood
  topNegative: CorrelationResult | null; // Worst for mood
}

const MIN_ENTRIES_FOR_CORRELATION = 3;

type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function getTimeOfDayLabel(time: TimeOfDay): string {
  const labels: Record<TimeOfDay, string> = {
    morning: "Mornings",
    afternoon: "Afternoons",
    evening: "Evenings",
    night: "Nights",
  };
  return labels[time];
}

function getTimeOfDayIcon(time: TimeOfDay): string {
  const icons: Record<TimeOfDay, string> = {
    morning: "sunny-outline",
    afternoon: "partly-sunny-outline",
    evening: "moon-outline",
    night: "cloudy-night-outline",
  };
  return icons[time];
}

function getDayLabel(dayIndex: number): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[dayIndex];
}

/**
 * Compute correlations between moods and various factors
 */
export function computeCorrelations(moods: MoodEntry[]): CorrelationSummary {
  if (moods.length < MIN_ENTRIES_FOR_CORRELATION) {
    return {
      overallAvg: 0,
      totalEntries: moods.length,
      correlations: [],
      topPositive: null,
      topNegative: null,
    };
  }

  // Calculate overall average
  const overallAvg = moods.reduce((sum, m) => sum + m.mood, 0) / moods.length;

  const correlations: CorrelationResult[] = [];

  // Emotion correlations
  const emotionStats = computeEmotionCorrelations(moods, overallAvg);
  correlations.push(...emotionStats);

  // Context correlations
  const contextStats = computeContextCorrelations(moods, overallAvg);
  correlations.push(...contextStats);

  // Time of day correlations
  const timeStats = computeTimeOfDayCorrelations(moods, overallAvg);
  correlations.push(...timeStats);

  // Day of week correlations
  const dayStats = computeDayOfWeekCorrelations(moods, overallAvg);
  correlations.push(...dayStats);

  // Energy correlations
  const energyStats = computeEnergyCorrelations(moods, overallAvg);
  correlations.push(...energyStats);

  // Sort by absolute delta (most significant first)
  correlations.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // Find top positive and negative
  const topPositive = correlations.find((c) => c.isPositive) || null;
  const topNegative = correlations.find((c) => !c.isPositive) || null;

  return {
    overallAvg,
    totalEntries: moods.length,
    correlations,
    topPositive,
    topNegative,
  };
}

/**
 * Compute emotion-mood correlations
 */
function computeEmotionCorrelations(moods: MoodEntry[], overallAvg: number): CorrelationResult[] {
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

  const results: CorrelationResult[] = [];

  Object.entries(emotionStats)
    .filter(([_, data]) => data.count >= MIN_ENTRIES_FOR_CORRELATION)
    .forEach(([name, data]) => {
      const avgMood = data.total / data.count;
      const delta = avgMood - overallAvg;
      const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

      results.push({
        type: "emotion",
        label: capitalize(name),
        avgMood,
        delta,
        count: data.count,
        icon: "heart-outline",
        isPositive: delta < 0, // Lower mood value = better, so negative delta is positive
      });
    });

  return results;
}

/**
 * Compute context-mood correlations
 */
function computeContextCorrelations(moods: MoodEntry[], overallAvg: number): CorrelationResult[] {
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

  const results: CorrelationResult[] = [];

  Object.entries(contextStats)
    .filter(([_, data]) => data.count >= MIN_ENTRIES_FOR_CORRELATION)
    .forEach(([name, data]) => {
      const avgMood = data.total / data.count;
      const delta = avgMood - overallAvg;
      const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

      results.push({
        type: "context",
        label: capitalize(name),
        avgMood,
        delta,
        count: data.count,
        icon: "location-outline",
        isPositive: delta < 0,
      });
    });

  return results;
}

/**
 * Compute time of day correlations
 */
function computeTimeOfDayCorrelations(moods: MoodEntry[], overallAvg: number): CorrelationResult[] {
  const timeStats: Record<TimeOfDay, { total: number; count: number }> = {
    morning: { total: 0, count: 0 },
    afternoon: { total: 0, count: 0 },
    evening: { total: 0, count: 0 },
    night: { total: 0, count: 0 },
  };

  moods.forEach((mood) => {
    const hour = getHours(new Date(mood.timestamp));
    const period = getTimeOfDay(hour);
    timeStats[period].total += mood.mood;
    timeStats[period].count++;
  });

  const results: CorrelationResult[] = [];

  (Object.entries(timeStats) as [TimeOfDay, { total: number; count: number }][])
    .filter(([_, data]) => data.count >= MIN_ENTRIES_FOR_CORRELATION)
    .forEach(([time, data]) => {
      const avgMood = data.total / data.count;
      const delta = avgMood - overallAvg;

      results.push({
        type: "time_of_day",
        label: getTimeOfDayLabel(time),
        avgMood,
        delta,
        count: data.count,
        icon: getTimeOfDayIcon(time),
        isPositive: delta < 0,
      });
    });

  return results;
}

/**
 * Compute day of week correlations
 */
function computeDayOfWeekCorrelations(moods: MoodEntry[], overallAvg: number): CorrelationResult[] {
  const dayStats: Record<number, { total: number; count: number }> = {};

  for (let i = 0; i < 7; i++) {
    dayStats[i] = { total: 0, count: 0 };
  }

  moods.forEach((mood) => {
    const dayIndex = getDay(new Date(mood.timestamp));
    dayStats[dayIndex].total += mood.mood;
    dayStats[dayIndex].count++;
  });

  const results: CorrelationResult[] = [];

  Object.entries(dayStats)
    .filter(([_, data]) => data.count >= MIN_ENTRIES_FOR_CORRELATION)
    .forEach(([day, data]) => {
      const avgMood = data.total / data.count;
      const delta = avgMood - overallAvg;
      const dayIndex = parseInt(day, 10);
      const weekend = isWeekend(new Date(2024, 0, dayIndex + 7)); // Any date with correct day

      results.push({
        type: "day_of_week",
        label: getDayLabel(dayIndex),
        avgMood,
        delta,
        count: data.count,
        icon: weekend ? "sunny-outline" : "calendar-outline",
        isPositive: delta < 0,
      });
    });

  return results;
}

/**
 * Compute energy level correlations
 */
function computeEnergyCorrelations(moods: MoodEntry[], overallAvg: number): CorrelationResult[] {
  // Group energy into low (0-3), medium (4-6), high (7-10)
  const energyBuckets: Record<string, { total: number; count: number; label: string }> = {
    low: { total: 0, count: 0, label: "Low Energy (0-3)" },
    medium: { total: 0, count: 0, label: "Medium Energy (4-6)" },
    high: { total: 0, count: 0, label: "High Energy (7-10)" },
  };

  moods.forEach((mood) => {
    if (mood.energy !== null && mood.energy !== undefined) {
      const bucket = mood.energy <= 3 ? "low" : mood.energy <= 6 ? "medium" : "high";
      energyBuckets[bucket].total += mood.mood;
      energyBuckets[bucket].count++;
    }
  });

  const results: CorrelationResult[] = [];

  Object.entries(energyBuckets)
    .filter(([_, data]) => data.count >= MIN_ENTRIES_FOR_CORRELATION)
    .forEach(([bucket, data]) => {
      const avgMood = data.total / data.count;
      const delta = avgMood - overallAvg;

      results.push({
        type: "energy",
        label: data.label,
        avgMood,
        delta,
        count: data.count,
        icon: bucket === "low" ? "battery-dead-outline" : bucket === "medium" ? "battery-half-outline" : "battery-full-outline",
        isPositive: delta < 0,
      });
    });

  return results;
}

/**
 * Get top N correlations (by absolute delta)
 */
export function getTopCorrelations(summary: CorrelationSummary, n: number = 5): CorrelationResult[] {
  return summary.correlations.slice(0, n);
}

/**
 * Filter correlations by type
 */
export function filterCorrelationsByType(
  summary: CorrelationSummary,
  type: CorrelationResult["type"]
): CorrelationResult[] {
  return summary.correlations.filter((c) => c.type === type);
}

/**
 * Format delta for display
 */
export function formatDelta(delta: number, precision: number = 1): string {
  const absValue = Math.abs(delta).toFixed(precision);
  if (delta < 0) {
    return `-${absValue}`;
  }
  return `+${absValue}`;
}

/**
 * Get a human-readable description of a correlation
 */
export function getCorrelationDescription(correlation: CorrelationResult): string {
  const betterOrWorse = correlation.isPositive ? "better" : "worse";
  const delta = formatDelta(correlation.delta);

  switch (correlation.type) {
    case "emotion":
      return `When feeling "${correlation.label}", mood is ${delta} (${betterOrWorse})`;
    case "context":
      return `"${correlation.label}" activities: mood is ${delta} (${betterOrWorse})`;
    case "time_of_day":
      return `${correlation.label}: mood is ${delta} (${betterOrWorse})`;
    case "day_of_week":
      return `${correlation.label}s: mood is ${delta} (${betterOrWorse})`;
    case "energy":
      return `${correlation.label}: mood is ${delta} (${betterOrWorse})`;
    default:
      return `${correlation.label}: ${delta}`;
  }
}
