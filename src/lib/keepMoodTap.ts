import type { MoodEntry, MoodEntryInput } from "@db/types";
import { createMoodOnlyEntryValues } from "@/components/entry/moodEntryDraft";
import { shouldOfferCrisisSupport } from "./crisisSupport";
import { commitThenRunPostCommitEffects, getMoodEntryPersistenceValues } from "./moodEntryPersistence";

/** Delay before the support sheet, so the tile press settles first. */
export const SUPPORT_SHEET_DELAY_MS = 250;

export type KeepMoodTapDeps = {
  /** Held from the tap until the follow-up takes over; a second tap is ignored. */
  inFlight: { current: boolean };
  create: (entry: MoodEntryInput) => Promise<MoodEntry>;
  afterCommit: readonly (() => void)[];
  /** True when any quick-entry field is on. */
  offersDetail: boolean;
  openDetail: (entry: MoodEntry) => void;
  showUndoToast: (entry: MoodEntry) => void;
  /** Shows the support sheet; `onDecline` runs on "Not now". */
  showSupport: (onDecline: () => void) => void;
  feedback: { commit: () => void; reject: () => void };
  onSaveError: (error: unknown) => void;
};

/**
 * One tap keeps a mood-only entry. Severe ratings show support first and
 * continue after "Not now"; other ratings continue at once. The follow-up is
 * the optional detail sheet, or a toast with Undo when every quick-entry field
 * is off.
 */
export async function keepMoodTap(mood: number, deps: KeepMoodTapDeps): Promise<void> {
  if (deps.inFlight.current) return;
  deps.inFlight.current = true;
  const release = () => {
    deps.inFlight.current = false;
  };

  let entry: MoodEntry;
  try {
    entry = await commitThenRunPostCommitEffects(
      () => deps.create(getMoodEntryPersistenceValues(createMoodOnlyEntryValues(mood))),
      deps.afterCommit,
    );
  } catch (error) {
    release();
    deps.feedback.reject();
    deps.onSaveError(error);
    return;
  }

  const continueAfterKeep = () => {
    if (deps.offersDetail) deps.openDetail(entry);
    else deps.showUndoToast(entry);
  };

  if (shouldOfferCrisisSupport(mood)) {
    deps.feedback.reject();
    setTimeout(() => {
      try {
        deps.showSupport(continueAfterKeep);
      } finally {
        release();
      }
    }, SUPPORT_SHEET_DELAY_MS);
    return;
  }

  deps.feedback.commit();
  try {
    continueAfterKeep();
  } finally {
    release();
  }
}
