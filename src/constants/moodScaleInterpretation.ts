import { moodScale } from "./moodScale";
import type { MoodScaleSnapshot } from "../../db/types";

export const CURRENT_MOOD_SCALE: MoodScaleSnapshot = {
  version: 1,
  min: 0,
  max: 10,
  lowerIsBetter: true,
};

export function getCurrentMoodScaleSnapshot(): MoodScaleSnapshot {
  return { ...CURRENT_MOOD_SCALE };
}

export function clampMoodRating(value: number): number {
  if (!Number.isFinite(value)) {
    return 5;
  }
  return Math.min(CURRENT_MOOD_SCALE.max, Math.max(CURRENT_MOOD_SCALE.min, Math.round(value)));
}

export function compareMoodRatings(a: number, b: number): number {
  const normalizedA = clampMoodRating(a);
  const normalizedB = clampMoodRating(b);
  return CURRENT_MOOD_SCALE.lowerIsBetter
    ? normalizedB - normalizedA
    : normalizedA - normalizedB;
}

export function isBetterMoodRating(a: number, b: number): boolean {
  return compareMoodRatings(a, b) > 0;
}

export function getMoodRatingDisplay(value: number, dark = false) {
  const rating = clampMoodRating(value);
  const item = moodScale.find((mood) => mood.value === rating) ?? moodScale[5];
  return {
    ...item,
    value: rating,
    backgroundHex: dark ? item.bgHexDark : item.bgHex,
    textHexResolved: dark ? item.textHexDark : item.textHex,
  };
}
