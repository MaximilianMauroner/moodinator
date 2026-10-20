import { Platform } from "react-native";
import { allowScreenCaptureAsync, preventScreenCaptureAsync } from "expo-screen-capture";

const APP_LOCK_CAPTURE_KEY = "moodinator-app-lock";

export const appLockCaptureProtectionApplies = Platform.OS === "android";

/** The caller hides private windows until this operation succeeds. */
export async function applyAppLockCaptureProtection(enabled: boolean): Promise<void> {
  if (!appLockCaptureProtectionApplies) return;

  if (!enabled) {
    await allowScreenCaptureAsync(APP_LOCK_CAPTURE_KEY);
    return;
  }

  try {
    await preventScreenCaptureAsync(APP_LOCK_CAPTURE_KEY);
  } catch (error) {
    // Expo records the key before its native call. Remove a failed activation
    // so a retry reaches native code instead of silently returning success.
    await allowScreenCaptureAsync(APP_LOCK_CAPTURE_KEY).catch(() => undefined);
    throw error;
  }
}
