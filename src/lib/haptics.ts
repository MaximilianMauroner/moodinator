/**
 * Centralized haptic feedback utilities
 * Provides consistent tactile feedback across the app.
 */

import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Check if haptics are supported on the current platform
 */
const isHapticsSupported = Platform.OS !== "web";

/**
 * Module-level flag to enable/disable haptic feedback globally.
 * This is set by the settings store on app startup and when settings change.
 */
let hapticsEnabled = true;

/**
 * Set the global haptics enabled state.
 * Called by the settings store when preferences change.
 */
export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
}

/**
 * Get the current haptics enabled state.
 */
export function getHapticsEnabled(): boolean {
  return hapticsEnabled;
}

/**
 * Check if haptics should fire (supported and enabled)
 */
function shouldTriggerHaptics(): boolean {
  return isHapticsSupported && hapticsEnabled;
}

/**
 * Haptic feedback utilities
 */
export const haptics = {
  /**
   * Light impact - subtle feedback for minor interactions
   * Use for: button presses, toggles, small selections
   */
  light: () => {
    if (shouldTriggerHaptics()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  },

  /**
   * Medium impact - moderate feedback for standard interactions
   * Use for: dragging, menu selections, card interactions
   */
  medium: () => {
    if (shouldTriggerHaptics()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  },

  /**
   * Heavy impact - strong feedback for significant actions
   * Use for: completing major actions, emphasis
   */
  heavy: () => {
    if (shouldTriggerHaptics()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  },

  /**
   * Success notification - positive feedback
   * Use for: save success, entry creation, restore actions
   */
  success: () => {
    if (shouldTriggerHaptics()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  },

  /**
   * Warning notification - cautionary feedback
   * Use for: delete actions, swipe-to-delete, destructive operations
   */
  warning: () => {
    if (shouldTriggerHaptics()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  },

  /**
   * Error notification - negative feedback
   * Use for: validation errors, failed operations
   */
  error: () => {
    if (shouldTriggerHaptics()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  },

  /**
   * Selection changed - light tick feedback
   * Use for: picker changes, slider movements, scrolling selections
   */
  selection: () => {
    if (shouldTriggerHaptics()) {
      Haptics.selectionAsync();
    }
  },
};

export default haptics;
