/**
 * Centralized, semantic haptic feedback.
 *
 * Keep feedback short and native: one system-defined event per interaction.
 * Callers intentionally receive a synchronous, fire-and-forget API.
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

function selection(): void {
  // Android's view-based feedback targets the activity behind a native Modal.
  // Expo selection uses the vibrator directly without depending on that view.
  perform(Haptics.selectionAsync);
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

const light = () =>
  impact(
    Haptics.ImpactFeedbackStyle.Light,
    Haptics.AndroidHaptics.Context_Click
  );
const medium = () =>
  impact(
    Haptics.ImpactFeedbackStyle.Medium,
    {
      preferred: Haptics.AndroidHaptics.Confirm,
      minimumApiLevel: 30,
      fallback: Haptics.AndroidHaptics.Long_Press,
    }
  );
const rigid = () =>
  impact(
    Haptics.ImpactFeedbackStyle.Rigid,
    Haptics.AndroidHaptics.Context_Click
  );
const success = () =>
  notification(
    Haptics.NotificationFeedbackType.Success,
    {
      preferred: Haptics.AndroidHaptics.Confirm,
      minimumApiLevel: 30,
      fallback: Haptics.AndroidHaptics.Context_Click,
    }
  );
const warning = () =>
  notification(
    Haptics.NotificationFeedbackType.Warning,
    {
      preferred: Haptics.AndroidHaptics.Reject,
      minimumApiLevel: 30,
      fallback: Haptics.AndroidHaptics.Long_Press,
    }
  );
const error = () =>
  notification(
    Haptics.NotificationFeedbackType.Error,
    {
      preferred: Haptics.AndroidHaptics.Reject,
      minimumApiLevel: 30,
      fallback: Haptics.AndroidHaptics.Long_Press,
    }
  );

export const haptics = {
  // Low-level primitives retained for existing interaction call sites.
  selection,
  light,
  medium,
  success,
  warning,
  error,

  // Semantic events. Each resolves to one restrained native event.
  moodLogged: success,
  destructive: rigid,
  swipeThreshold: () =>
    impact(
      Haptics.ImpactFeedbackStyle.Soft,
      {
        preferred: Haptics.AndroidHaptics.Gesture_Start,
        minimumApiLevel: 30,
        fallback: Haptics.AndroidHaptics.Context_Click,
      }
    ),
  longPressActivate: () =>
    impact(
      Haptics.ImpactFeedbackStyle.Rigid,
      Haptics.AndroidHaptics.Long_Press
    ),
  monthChange: selection,
  pinDigit: () =>
    impact(
      Haptics.ImpactFeedbackStyle.Soft,
      Haptics.AndroidHaptics.Keyboard_Tap
    ),
  pinError: error,
  unlockSuccess: success,
  pageChange: selection,
};

export default haptics;
