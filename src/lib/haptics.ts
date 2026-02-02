/**
 * Centralized haptic feedback utilities
 * Uses react-native-haptic-feedback for crisp, low-latency haptics.
 * Includes pattern support for Android via Vibration API.
 */

import { Platform, Vibration } from "react-native";
import ReactNativeHapticFeedback, {
  HapticFeedbackTypes,
} from "react-native-haptic-feedback";

const isHapticsSupported = Platform.OS !== "web";

let hapticsEnabled = true;

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: true,
};

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
}

export function getHapticsEnabled(): boolean {
  return hapticsEnabled;
}

// Vibration durations for Android fallback (in ms)
const vibrationDurations: Record<string, number> = {
  [HapticFeedbackTypes.selection]: 10,
  [HapticFeedbackTypes.impactLight]: 20,
  [HapticFeedbackTypes.impactMedium]: 40,
  [HapticFeedbackTypes.impactHeavy]: 60,
  [HapticFeedbackTypes.rigid]: 30,
  [HapticFeedbackTypes.soft]: 15,
  [HapticFeedbackTypes.notificationSuccess]: 50,
  [HapticFeedbackTypes.notificationWarning]: 50,
  [HapticFeedbackTypes.notificationError]: 80,
};

/**
 * Vibration patterns for Android
 * Format: [pause, vibrate, pause, vibrate, ...]
 * First element (0) means start immediately
 */
const vibrationPatterns = {
  // Double tap pattern
  doubleTap: [0, 15, 80, 15],

  // Success pattern - gentle ascending
  confirm: [0, 20, 60, 30],

  // Delete/undo pattern - descending emphasis
  delete: [0, 40, 50, 20],

  // Warning pattern - attention-getting
  warning: [0, 30, 100, 30, 100, 30],

  // Success celebration - playful
  success: [0, 15, 50, 25, 50, 35],

  // Error pattern - strong feedback
  errorPattern: [0, 50, 80, 50],

  // Soft pattern - very gentle
  softPattern: [0, 10, 50, 10],

  // Onboarding transition - smooth
  onboardingTransition: [0, 15, 40, 10],

  // Mood selection - satisfying
  moodSelect: [0, 25, 30, 15],

  // Save confirmation - complete
  saveConfirm: [0, 20, 40, 30, 40, 20],
};

function trigger(type: HapticFeedbackTypes): void {
  if (isHapticsSupported && hapticsEnabled) {
    if (Platform.OS === "android") {
      // Use native Vibration API on Android as it's more reliable
      const duration = vibrationDurations[type] || 20;
      Vibration.vibrate(duration);
    } else {
      ReactNativeHapticFeedback.trigger(type, options);
    }
  }
}

/**
 * Trigger a vibration pattern (Android) or fallback haptic (iOS)
 */
function triggerPattern(pattern: number[], iosFallback: HapticFeedbackTypes): void {
  if (!isHapticsSupported || !hapticsEnabled) return;

  if (Platform.OS === "android") {
    Vibration.vibrate(pattern);
  } else {
    // iOS doesn't support custom patterns, use best-match haptic
    ReactNativeHapticFeedback.trigger(iosFallback, options);
  }
}

/**
 * Basic haptic feedback types
 */
export const haptics = {
  // Basic feedback types
  selection: () => trigger(HapticFeedbackTypes.selection),
  light: () => trigger(HapticFeedbackTypes.impactLight),
  medium: () => trigger(HapticFeedbackTypes.impactMedium),
  heavy: () => trigger(HapticFeedbackTypes.impactHeavy),
  rigid: () => trigger(HapticFeedbackTypes.rigid),
  soft: () => trigger(HapticFeedbackTypes.soft),
  success: () => trigger(HapticFeedbackTypes.notificationSuccess),
  warning: () => trigger(HapticFeedbackTypes.notificationWarning),
  error: () => trigger(HapticFeedbackTypes.notificationError),

  // Pattern-based feedback (enhanced)
  patterns: {
    /** Double tap - for toggle actions */
    doubleTap: () => triggerPattern(
      vibrationPatterns.doubleTap,
      HapticFeedbackTypes.impactLight
    ),

    /** Confirm - for confirmations and successful actions */
    confirm: () => triggerPattern(
      vibrationPatterns.confirm,
      HapticFeedbackTypes.notificationSuccess
    ),

    /** Delete - for destructive actions */
    delete: () => triggerPattern(
      vibrationPatterns.delete,
      HapticFeedbackTypes.notificationWarning
    ),

    /** Warning - for alerts and warnings */
    warning: () => triggerPattern(
      vibrationPatterns.warning,
      HapticFeedbackTypes.notificationWarning
    ),

    /** Success celebration - for achievements */
    successCelebration: () => triggerPattern(
      vibrationPatterns.success,
      HapticFeedbackTypes.notificationSuccess
    ),

    /** Error - for error states */
    errorAlert: () => triggerPattern(
      vibrationPatterns.errorPattern,
      HapticFeedbackTypes.notificationError
    ),

    /** Soft - for subtle feedback */
    softFeedback: () => triggerPattern(
      vibrationPatterns.softPattern,
      HapticFeedbackTypes.soft
    ),

    /** Onboarding - for tutorial transitions */
    onboardingStep: () => triggerPattern(
      vibrationPatterns.onboardingTransition,
      HapticFeedbackTypes.soft
    ),

    /** Mood select - for mood button selection */
    moodSelect: () => triggerPattern(
      vibrationPatterns.moodSelect,
      HapticFeedbackTypes.impactMedium
    ),

    /** Save - for save confirmations */
    saveComplete: () => triggerPattern(
      vibrationPatterns.saveConfirm,
      HapticFeedbackTypes.notificationSuccess
    ),
  },
};

/**
 * Cancel any ongoing vibration pattern
 */
export function cancelVibration(): void {
  if (Platform.OS !== "web") {
    Vibration.cancel();
  }
}

export default haptics;
