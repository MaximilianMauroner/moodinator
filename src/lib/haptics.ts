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
  selection: () => trigger(HapticFeedbackTypes.selection),
  light: () => trigger(HapticFeedbackTypes.impactLight),
  medium: () => trigger(HapticFeedbackTypes.impactMedium),
  heavy: () => trigger(HapticFeedbackTypes.impactHeavy),
  rigid: () => trigger(HapticFeedbackTypes.rigid),
  soft: () => trigger(HapticFeedbackTypes.soft),
  success: () => trigger(HapticFeedbackTypes.notificationSuccess),
  warning: () => trigger(HapticFeedbackTypes.notificationWarning),
  error: () => trigger(HapticFeedbackTypes.notificationError),
};

export default haptics;
