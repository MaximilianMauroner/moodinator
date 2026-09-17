import type { MoodEntry, MoodEntryInput } from "@db/types";
import type { MoodEntryFormValues } from "@/components/entry/moodEntryDraft";

type UpdateMoodEntry = (
  id: number,
  updates: Partial<MoodEntryInput & { mood: number }>,
) => Promise<MoodEntry | null | undefined>;

type UpdateMoodTimestamp = (
  id: number,
  timestamp: number,
  utcOffsetMinutes?: number | null,
) => Promise<MoodEntry | null | undefined>;

export function getMoodEntryPersistenceValues(
  values: MoodEntryFormValues,
): MoodEntryInput {
  return {
    mood: values.mood,
    note: values.note || null,
    emotions: values.emotions,
    contextTags: values.contextTags,
    energy: values.energy,
    basedOnEntryId: values.basedOnEntryId,
  };
}

export async function updateMoodEntryOrThrow(
  updateMood: UpdateMoodEntry,
  id: number,
  values: MoodEntryFormValues,
): Promise<MoodEntry> {
  const updated = await updateMood(id, getMoodEntryPersistenceValues(values));
  if (!updated) {
    throw new Error("This entry is no longer available.");
  }

  return updated;
}

export async function updateMoodTimestampOrThrow(
  updateMoodTimestamp: UpdateMoodTimestamp,
  id: number,
  timestamp: number,
  utcOffsetMinutes?: number | null,
): Promise<MoodEntry> {
  const updated = await updateMoodTimestamp(id, timestamp, utcOffsetMinutes);
  if (!updated) {
    throw new Error("This entry is no longer available.");
  }

  return updated;
}

/**
 * A durable commit owns the save result. Presentation work after that commit
 * is best effort and must not turn a successful write into a retryable error.
 */
export async function commitThenRunPostCommitEffects<T>(
  commit: () => Promise<T>,
  effects: readonly (() => void)[],
): Promise<T> {
  const result = await commit();

  for (const effect of effects) {
    try {
      effect();
    } catch (error) {
      console.error("Post-save presentation effect failed:", error);
    }
  }

  return result;
}
