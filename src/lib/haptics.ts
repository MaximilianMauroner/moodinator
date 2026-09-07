/**
 * Centralized, semantic haptic feedback.
 *
 * There are four levels and no more. Intensity carries meaning, so a saved
 * entry never feels like an opened settings page:
 *
 *   tick   — a value moved (selection, toggle, detent, month change)
 *   tap    — a target accepted the press (navigation, sheet open, threshold)
 *   commit — data was written (entry saved, undo restored, import finished)
 *   reject — the action failed or needs care (delete, wrong PIN, crisis entry)
 *
 * Callers intentionally receive a synchronous, fire-and-forget API. No screen
 * should fire more than one event per user action; compound feedback is what
 * makes an app feel noisy.
 */

import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

let hapticsEnabled = true;

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
}

export function getHapticsEnabled(): boolean {
  return hapticsEnabled;
}

type AndroidFeedback =
  | Haptics.AndroidHaptics
  | {
      fallback: Haptics.AndroidHaptics;
      minimumApiLevel: number;
      preferred: Haptics.AndroidHaptics;
    };

function getAndroidFeedback(feedback: AndroidFeedback): {
  fallback: Haptics.AndroidHaptics;
  type: Haptics.AndroidHaptics;
} {
  if (typeof feedback === "string") {
    return { fallback: feedback, type: feedback };
  }

  const apiLevel =
    typeof Platform.Version === "number"
      ? Platform.Version
      : Number.parseInt(String(Platform.Version), 10);
  const supportsPreferred =
    Number.isFinite(apiLevel) && apiLevel >= feedback.minimumApiLevel;

  return {
    fallback: feedback.fallback,
    type: supportsPreferred ? feedback.preferred : feedback.fallback,
  };
}

function performAndroid(feedback: AndroidFeedback): Promise<void> {
  const { fallback, type } = getAndroidFeedback(feedback);

  return Haptics.performAndroidHapticsAsync(type).catch(() => {
    if (type === fallback) return;
    return Haptics.performAndroidHapticsAsync(fallback).catch(() => {
      // Haptics are an enhancement and should never interrupt an interaction.
    });
  });
}

function perform(feedback: () => Promise<void>): void {
  if (!hapticsEnabled || (Platform.OS !== "android" && Platform.OS !== "ios")) return;

  try {
    void feedback().catch(() => {
      // Haptics are an enhancement and should never interrupt an interaction.
    });
  } catch {
    // Gracefully handle devices or runtimes without a haptic engine.
  }
}

function impact(
  iosStyle: Haptics.ImpactFeedbackStyle,
  androidType: AndroidFeedback
): void {
  perform(() => Platform.OS === "android"
    ? performAndroid(androidType)
    : Haptics.impactAsync(iosStyle));
}

function notification(
  iosType: Haptics.NotificationFeedbackType,
  androidType: AndroidFeedback
): void {
  perform(() => Platform.OS === "android"
    ? performAndroid(androidType)
    : Haptics.notificationAsync(iosType));
}

/**
 * A value moved: selection change, switch toggle, slider detent, month change.
 *
 * Android's view-based feedback targets the activity behind a native Modal.
 * Expo selection uses the vibrator directly without depending on that view.
 */
function tick(): void {
  perform(Haptics.selectionAsync);
}

/** A target accepted the press: navigation, sheet open, swipe threshold. */
function tap(): void {
  impact(Haptics.ImpactFeedbackStyle.Light, Haptics.AndroidHaptics.Context_Click);
}

/** Data was written: entry saved, undo restored, import finished. */
function commit(): void {
  notification(Haptics.NotificationFeedbackType.Success, {
    preferred: Haptics.AndroidHaptics.Confirm,
    minimumApiLevel: 30,
    fallback: Haptics.AndroidHaptics.Context_Click,
  });
}

/** The action failed or needs care: delete, save failure, wrong PIN, crisis entry. */
function reject(): void {
  notification(Haptics.NotificationFeedbackType.Warning, {
    preferred: Haptics.AndroidHaptics.Reject,
    minimumApiLevel: 30,
    fallback: Haptics.AndroidHaptics.Long_Press,
  });
}

export const haptics = { tick, tap, commit, reject };

export type HapticLevel = keyof typeof haptics;

export default haptics;
