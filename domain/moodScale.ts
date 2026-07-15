import type { MoodScaleSnapshot } from "../db/types";

export const CURRENT_MOOD_SCALE_SNAPSHOT: MoodScaleSnapshot = {
  version: 1,
  min: 0,
  max: 10,
  lowerIsBetter: true,
};

export const LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT: MoodScaleSnapshot = {
  version: 2,
  min: 0,
  max: 10,
  lowerIsBetter: false,
};

export const SUPPORTED_MOOD_SCALE_SNAPSHOTS = [
  CURRENT_MOOD_SCALE_SNAPSHOT,
  LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT,
] as const;

export function getCurrentMoodScaleSnapshot(): MoodScaleSnapshot {
  return { ...CURRENT_MOOD_SCALE_SNAPSHOT };
}

export function getSupportedMoodScaleSnapshot(value: unknown): MoodScaleSnapshot | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const scale = SUPPORTED_MOOD_SCALE_SNAPSHOTS.find(
    (snapshot) =>
      candidate.version === snapshot.version &&
      candidate.min === snapshot.min &&
      candidate.max === snapshot.max &&
      candidate.lowerIsBetter === snapshot.lowerIsBetter
  );

  return scale ? { ...scale } : null;
}

export function isSupportedMoodScaleSnapshot(value: unknown): value is MoodScaleSnapshot {
  return getSupportedMoodScaleSnapshot(value) !== null;
}
