/**
 * Mood presentation helpers
 *
 * Pure functions that map numeric Mood Rating values and trend deltas to the
 * Tailwind class strings and hex colours consumed by UI components. No React
 * imports — every function is testable with plain Vitest.
 */

import { moodScale } from "@/constants/moodScale";

/** Returns the hex colour for a Mood Rating value.
 *  Uses textHexDark when isDark is true. Falls back to a neutral slate if the
 *  value is not found on the Mood Scale (should not happen for 0–10). */
export const getMoodHex = (value: number, isDark?: boolean): string => {
  const mood = moodScale.find((m) => m.value === Math.round(value));
  if (!mood) return "#64748b";
  return (isDark ? mood.textHexDark : mood.textHex) ?? "#64748b";
};

/** Returns the Tailwind text-colour class for a Mood Rating value. */
export const getMoodScaleColor = (moodValue: number): string => {
  const mood = moodScale.find((m) => m.value === Math.round(moodValue));
  return mood ? mood.color : "text-slate-500";
};

/** Returns the Tailwind background-colour class for a Mood Rating value. */
export const getMoodScaleBg = (moodValue: number): string => {
  const mood = moodScale.find((m) => m.value === Math.round(moodValue));
  return mood ? mood.bg : "bg-slate-100";
};

export interface MoodInterpretation {
  /** Plain colour name extracted from the Tailwind class, e.g. "sage-600" */
  color: string;
  /** Mood Rating Label text, e.g. "Neutral" */
  text: string;
  bg: string;
  textClass: string;
  bgClass: string;
}

/** Maps an average Mood Rating to a labelled colour interpretation. */
export const getMoodInterpretation = (average: number): MoodInterpretation => {
  const roundedAverage = Math.round(average);
  const moodInfo = moodScale.find((m) => m.value === roundedAverage);

  if (moodInfo) {
    return {
      color: moodInfo.color.replace("text-", ""),
      text: moodInfo.label,
      bg: moodInfo.bg,
      textClass: moodInfo.color,
      bgClass: moodInfo.bg,
    };
  }

  // Fallback — should only be reached for values outside 0–10
  if (average <= 2)
    return {
      color: "sky-500",
      text: "Excellent",
      bg: "bg-sky-100",
      textClass: "text-sky-500",
      bgClass: "bg-sky-100",
    };
  if (average <= 4)
    return {
      color: "green-500",
      text: "Good",
      bg: "bg-green-100",
      textClass: "text-green-500",
      bgClass: "bg-green-100",
    };
  if (average <= 6)
    return {
      color: "yellow-500",
      text: "Fair",
      bg: "bg-yellow-100",
      textClass: "text-yellow-500",
      bgClass: "bg-yellow-100",
    };
  if (average <= 8)
    return {
      color: "orange-600",
      text: "Challenging",
      bg: "bg-orange-100",
      textClass: "text-orange-600",
      bgClass: "bg-orange-100",
    };
  return {
    color: "red-500",
    text: "Difficult",
    bg: "bg-red-100",
    textClass: "text-red-500",
    bgClass: "bg-red-100",
  };
};

export interface TrendInterpretation {
  color: string;
  text: string;
  iconName:
    | "trending-up-outline"
    | "arrow-up-outline"
    | "trending-down-outline"
    | "arrow-down-outline"
    | "remove-outline";
  textClass: string;
  bgClass: string;
}

/**
 * Maps a mood trend delta to a labelled direction.
 * Note: on the Mood Scale, lower numbers are better, so a negative delta means
 * improvement.
 */
export const getTrendInterpretation = (trend: number): TrendInterpretation => {
  if (trend < -0.5)
    return {
      color: "green",
      text: "Trending Better",
      iconName: "trending-up-outline",
      textClass: "text-emerald-600",
      bgClass: "bg-emerald-100 dark:bg-emerald-900/30",
    };
  if (trend < 0)
    return {
      color: "blue",
      text: "Improving",
      iconName: "arrow-up-outline",
      textClass: "text-blue-600",
      bgClass: "bg-blue-100 dark:bg-blue-900/30",
    };
  if (trend > 0.5)
    return {
      color: "red",
      text: "Declining",
      iconName: "trending-down-outline",
      textClass: "text-red-600",
      bgClass: "bg-red-100 dark:bg-red-900/30",
    };
  if (trend > 0)
    return {
      color: "orange",
      text: "Slight Dip",
      iconName: "arrow-down-outline",
      textClass: "text-amber-600",
      bgClass: "bg-amber-100 dark:bg-amber-900/30",
    };
  return {
    color: "gray",
    text: "Steady",
    iconName: "remove-outline",
    textClass: "text-slate-600",
    bgClass: "bg-slate-100 dark:bg-slate-800",
  };
};
