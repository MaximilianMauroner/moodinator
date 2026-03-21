/**
 * Centralized haptic feedback utilities
 * Uses react-native-haptic-feedback for crisp, low-latency haptics.
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
 * Custom haptic patterns for contextual feedback
 * Each pattern is an array of [duration, pause, duration, pause, ...]
 * Durations are in milliseconds
 */
const patterns = {
  // Celebration pattern for mood logged - ascending intensity
  moodLogged: [20, 40, 20, 40, 30, 40, 40],
  // Warning pattern for destructive actions
  destructive: [60, 100, 60],
  // Subtle feedback when swipe threshold is reached
  swipeThreshold: [40, 30, 20],
  // Long press activation feedback - building intensity
  longPressActivate: [10, 30, 50],
  // Calendar month navigation
  monthChange: [15, 30, 15],
  // PIN keypad digit press
  pinDigit: [8],
  // Wrong PIN error - urgent, repetitive
  pinError: [80, 60, 80, 60, 80],
  // Successful unlock - satisfying crescendo
  unlockSuccess: [15, 50, 25, 50, 35],
  // Onboarding page change
  pageChange: [12],
} as const;

type PatternName = keyof typeof patterns;

/**
 * Play a custom haptic pattern
 * On iOS: Uses multiple haptic triggers with delays
 * On Android: Uses vibration pattern
 */
function playPattern(patternName: PatternName): void {
  if (!isHapticsSupported || !hapticsEnabled) return;

  const pattern = patterns[patternName];

  if (Platform.OS === "android") {
    // Android Vibration.vibrate expects [pause, vibrate, pause, vibrate, ...]
    // Our patterns are [vibrate, pause, vibrate, pause, ...]
    // Prepend 0 to start immediately
    Vibration.vibrate([0, ...pattern]);
  } else {
    // iOS: Trigger haptics with delays to create pattern
    let delay = 0;
    for (let i = 0; i < pattern.length; i++) {
      const duration = pattern[i];
      // Even indices are vibration durations, odd are pauses
      if (i % 2 === 0) {
        setTimeout(() => {
          if (hapticsEnabled) {
            // Map duration to haptic type
            if (duration <= 15) {
              ReactNativeHapticFeedback.trigger(HapticFeedbackTypes.soft, options);
            } else if (duration <= 30) {
              ReactNativeHapticFeedback.trigger(HapticFeedbackTypes.impactLight, options);
            } else if (duration <= 50) {
              ReactNativeHapticFeedback.trigger(HapticFeedbackTypes.impactMedium, options);
            } else {
              ReactNativeHapticFeedback.trigger(HapticFeedbackTypes.impactHeavy, options);
            }
          }
        }, delay);
      }
      delay += duration;
    }
  }
}

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

export const haptics = {
  // Basic haptics
  selection: () => trigger(HapticFeedbackTypes.selection),
  light: () => trigger(HapticFeedbackTypes.impactLight),
  medium: () => trigger(HapticFeedbackTypes.impactMedium),
  heavy: () => trigger(HapticFeedbackTypes.impactHeavy),
  rigid: () => trigger(HapticFeedbackTypes.rigid),
  soft: () => trigger(HapticFeedbackTypes.soft),
  success: () => trigger(HapticFeedbackTypes.notificationSuccess),
  warning: () => trigger(HapticFeedbackTypes.notificationWarning),
  error: () => trigger(HapticFeedbackTypes.notificationError),

  // Contextual haptic patterns
  moodLogged: () => playPattern("moodLogged"),
  destructive: () => playPattern("destructive"),
  swipeThreshold: () => playPattern("swipeThreshold"),
  longPressActivate: () => playPattern("longPressActivate"),
  monthChange: () => playPattern("monthChange"),
  pinDigit: () => playPattern("pinDigit"),
  pinError: () => playPattern("pinError"),
  unlockSuccess: () => playPattern("unlockSuccess"),
  pageChange: () => playPattern("pageChange"),
};

export default haptics;
