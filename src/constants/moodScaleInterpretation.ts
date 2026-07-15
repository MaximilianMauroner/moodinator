import { moodScale } from "./moodScale";
import type { MoodEntry, MoodScaleSnapshot } from "../../db/types";
import type { MoodScale } from "@/types/mood";
import {
  CURRENT_MOOD_SCALE_SNAPSHOT,
  getCurrentMoodScaleSnapshot as getDomainCurrentMoodScaleSnapshot,
} from "../../domain/moodScale";

export const CURRENT_MOOD_SCALE: MoodScaleSnapshot = CURRENT_MOOD_SCALE_SNAPSHOT;

export function getCurrentMoodScaleSnapshot(): MoodScaleSnapshot {
  return getDomainCurrentMoodScaleSnapshot();
}

export function clampMoodRating(
  value: number,
  scale: MoodScaleSnapshot = CURRENT_MOOD_SCALE
): number {
  if (!Number.isFinite(value)) {
    return getNeutralMoodRating(scale);
  }
  return Math.min(scale.max, Math.max(scale.min, Math.round(value)));
}

export function isKnownMoodRating(
  value: number,
  scale: MoodScaleSnapshot = CURRENT_MOOD_SCALE
): boolean {
  if (!Number.isFinite(value)) {
    return false;
  }
  const rounded = Math.round(value);
  return rounded >= scale.min && rounded <= scale.max;
}

function getScaleRange(scale: MoodScaleSnapshot): number {
  return Math.max(1, scale.max - scale.min);
}

export function getMoodRatingSeverity(
  value: number,
  scale: MoodScaleSnapshot = CURRENT_MOOD_SCALE
): number {
  // Clamp to the scale bounds WITHOUT rounding. Rounding here is only correct
  // for discrete entry ratings (always integers); severity is also computed for
  // averaged values (floats), where rounding would erase sub-integer
  // differences and, for example, make two distinct day-averages compare equal.
  const safeValue = Number.isFinite(value)
    ? value
    : getNeutralMoodRating(scale);
  const rating = Math.min(scale.max, Math.max(scale.min, safeValue));
  const range = getScaleRange(scale);
  const severity = scale.lowerIsBetter
    ? (rating - scale.min) / range
    : (scale.max - rating) / range;
  return Math.min(1, Math.max(0, severity));
}

export function normalizeMoodRating(
  value: number,
  sourceScale: MoodScaleSnapshot = CURRENT_MOOD_SCALE,
  targetScale: MoodScaleSnapshot = CURRENT_MOOD_SCALE
): number {
  const severity = getMoodRatingSeverity(value, sourceScale);
  const targetRange = getScaleRange(targetScale);
  const normalized = targetScale.lowerIsBetter
    ? targetScale.min + severity * targetRange
    : targetScale.max - severity * targetRange;
  return Math.round(normalized * 10) / 10;
}

export function getInterpretedMoodRating(entry: Pick<MoodEntry, "mood" | "moodScale">): number {
  return normalizeMoodRating(entry.mood, entry.moodScale);
}

export function compareMoodRatings(a: number, b: number): number {
  // Compare on severity (0 = best, 1 = worst) so the full precision of averaged
  // ratings is preserved. Returns > 0 when `a` is the better rating.
  return getMoodRatingSeverity(b) - getMoodRatingSeverity(a);
}

export function isBetterMoodRating(a: number, b: number): boolean {
  return compareMoodRatings(a, b) > 0;
}

export function getNeutralMoodRating(
  scale: MoodScaleSnapshot = CURRENT_MOOD_SCALE
): number {
  if (
    scale.min !== CURRENT_MOOD_SCALE.min ||
    scale.max !== CURRENT_MOOD_SCALE.max
  ) {
    return Math.round((scale.min + scale.max) / 2);
  }
  return (
    moodScale.find((mood) => mood.label === "Neutral")?.value ??
    Math.round((scale.min + scale.max) / 2)
  );
}

export function sortMoodRatingsBestFirst(a: number, b: number): number {
  // Ascending severity puts the best (lowest severity) rating first, preserving
  // sub-integer precision for averaged ratings.
  return getMoodRatingSeverity(a) - getMoodRatingSeverity(b);
}

export function getMoodRatingScaleItem(
  value: number,
  sourceScale: MoodScaleSnapshot = CURRENT_MOOD_SCALE
): MoodScale {
  const rating = clampMoodRating(normalizeMoodRating(value, sourceScale));
  return (
    moodScale.find((mood) => mood.value === rating) ??
    moodScale.find((mood) => mood.value === getNeutralMoodRating()) ??
    moodScale[0]!
  );
}

export function getMoodRatingLabel(
  value: number,
  sourceScale: MoodScaleSnapshot = CURRENT_MOOD_SCALE
): string {
  return getMoodRatingScaleItem(value, sourceScale).label;
}

export function getMoodRatingTextClass(
  value: number,
  sourceScale: MoodScaleSnapshot = CURRENT_MOOD_SCALE
): string {
  return getMoodRatingScaleItem(value, sourceScale).color;
}

export function getMoodRatingBgClass(
  value: number,
  sourceScale: MoodScaleSnapshot = CURRENT_MOOD_SCALE
): string {
  return getMoodRatingScaleItem(value, sourceScale).bg;
}

export function getMoodRatingTextHex(
  value: number,
  dark = false,
  sourceScale: MoodScaleSnapshot = CURRENT_MOOD_SCALE
): string {
  const item = getMoodRatingScaleItem(value, sourceScale);
  return (dark ? item.textHexDark : item.textHex) ?? "#64748b";
}

export function getMoodRatingBackgroundHex(
  value: number,
  dark = false,
  sourceScale: MoodScaleSnapshot = CURRENT_MOOD_SCALE
): string {
  const item = getMoodRatingScaleItem(value, sourceScale);
  return (dark ? item.bgHexDark : item.bgHex) ?? "#F9F5ED";
}

export type MoodTrendDirection = "up" | "down" | "stable";

export function getMoodTrendDirection(change: number, threshold = 0.1): MoodTrendDirection {
  if (Math.abs(change) <= threshold) {
    return "stable";
  }

  const gotBetter = CURRENT_MOOD_SCALE.lowerIsBetter ? change < 0 : change > 0;
  return gotBetter ? "down" : "up";
}

export interface MoodRatingDisplay extends MoodScale {
  roundedValue: number;
  backgroundHex: string;
  colorHex: string;
  textHexResolved: string;
  accessibilityText: string;
}

export function getMoodRatingAccessibilityText(
  value: number,
  sourceScale: MoodScaleSnapshot = CURRENT_MOOD_SCALE
): string {
  const rating = clampMoodRating(normalizeMoodRating(value, sourceScale));
  const item = getMoodRatingScaleItem(rating);
  return `Mood Rating ${rating} of ${CURRENT_MOOD_SCALE.max}: ${item.label}. ${item.description}`;
}

export function getMoodRatingDisplay(
  value: number,
  dark = false,
  sourceScale: MoodScaleSnapshot = CURRENT_MOOD_SCALE
): MoodRatingDisplay {
  const rating = clampMoodRating(normalizeMoodRating(value, sourceScale));
  const item = getMoodRatingScaleItem(rating);
  const colorHex = (dark ? item.textHexDark : item.textHex) ?? "#64748b";
  return {
    ...item,
    value: rating,
    roundedValue: rating,
    backgroundHex: (dark ? item.bgHexDark : item.bgHex) ?? "#F9F5ED",
    colorHex,
    textHexResolved: colorHex,
    accessibilityText: getMoodRatingAccessibilityText(rating),
  };
}

export function getAllMoodRatingDisplays(dark = false): MoodRatingDisplay[] {
  return moodScale.map((item) => getMoodRatingDisplay(item.value, dark));
}
