import type { MoodEntry, MoodEntryInput } from "@db/types";
import { createMoodOnlyEntryValues } from "@/components/entry/moodEntryDraft";
import { shouldOfferCrisisSupport } from "./crisisSupport";
import { commitThenRunPostCommitEffects, getMoodEntryPersistenceValues } from "./moodEntryPersistence";

/** Delay before the support sheet, so the tile press settles first. */
export const SUPPORT_SHEET_DELAY_MS = 250;
/**
 * Delay after "Not now" before the follow-up. A native modal opened while the
 * support sheet is still closing does not show on Android.
 */
export const SUPPORT_HANDOFF_MS = 400;

export type MoodEntryFlowState = {
  inFlight: boolean;
  generation: number;
};

/** A new quick or detailed save supersedes pending support follow-ups. */
export function beginMoodEntryFlow(state: MoodEntryFlowState): number {
  state.inFlight = false;
  return ++state.generation;
}

export type KeepMoodTapDeps = {
  /**
   * Held from the tap until the follow-up shows; a second tap is ignored. It
   * is free while the support sheet is open, so other support actions do not
   * leave the picker locked.
   */
  state: MoodEntryFlowState;
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
  if (deps.state.inFlight) return;
  const generation = beginMoodEntryFlow(deps.state);
  deps.state.inFlight = true;
  const ownsFlow = () => deps.state.generation === generation;
  const release = () => {
    if (ownsFlow()) deps.state.inFlight = false;
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

  if (!ownsFlow()) return;

  const continueAfterKeep = () => {
    if (!ownsFlow()) return;
    if (deps.offersDetail) deps.openDetail(entry);
    else deps.showUndoToast(entry);
  };

  // A delayed link failure can outlive this entry. Only its current flow may
  // hold taps and resume the follow-up.
  let continuationStarted = false;
  const continueAfterSupport = () => {
    if (!ownsFlow() || continuationStarted) return;
    continuationStarted = true;
    deps.state.inFlight = true;
    setTimeout(() => {
      try {
        continueAfterKeep();
      } finally {
        release();
      }
    }, SUPPORT_HANDOFF_MS);
  };

  if (shouldOfferCrisisSupport(mood)) {
    deps.feedback.reject();
    setTimeout(() => {
      try {
        if (ownsFlow()) deps.showSupport(continueAfterSupport);
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
