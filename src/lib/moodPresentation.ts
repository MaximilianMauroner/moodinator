/**
 * Mood presentation helpers
 *
 * Pure functions that map numeric Mood Rating values and trend deltas to the
 * Tailwind class strings and hex colours consumed by UI components. No React
 * imports — every function is testable with plain Vitest.
 */

import {
  getMoodRatingBgClass,
  getMoodRatingDisplay,
  getMoodRatingLabel,
  getMoodRatingTextClass,
  isKnownMoodRating,
} from "@/constants/moodScaleInterpretation";
import type { MoodScaleSnapshot } from "@db/types";

/** Returns the resolved hex colour for a Mood Rating value. */
export const getMoodHex = (
  value: number,
  isDark?: boolean,
  sourceScale?: MoodScaleSnapshot
): string => {
  if (!isKnownMoodRating(value, sourceScale)) return "#64748b";
  return getMoodRatingDisplay(value, isDark, sourceScale).colorHex;
};

/** Returns the Tailwind text-colour class for a Mood Rating value. */
export const getMoodScaleColor = (
  moodValue: number,
  sourceScale?: MoodScaleSnapshot
): string => {
  if (!isKnownMoodRating(moodValue, sourceScale)) return "text-slate-500";
  return getMoodRatingTextClass(moodValue, sourceScale);
};

/** Returns the Tailwind background-colour class for a Mood Rating value. */
export const getMoodScaleBg = (
  moodValue: number,
  sourceScale?: MoodScaleSnapshot
): string => {
  if (!isKnownMoodRating(moodValue, sourceScale)) return "bg-slate-100";
  return getMoodRatingBgClass(moodValue, sourceScale);
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
export const getMoodInterpretation = (
  average: number,
  sourceScale?: MoodScaleSnapshot
): MoodInterpretation => {
  const moodInfo = getMoodRatingDisplay(average, false, sourceScale);
  return {
    color: moodInfo.color.replace("text-", ""),
    text: getMoodRatingLabel(average, sourceScale),
    bg: moodInfo.bg,
    textClass: moodInfo.color,
    bgClass: moodInfo.bg,
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
