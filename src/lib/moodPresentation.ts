import {
  getMoodRatingDisplay,
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
