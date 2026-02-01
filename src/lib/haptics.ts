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
 * Haptic feedback utilities
 */
export const haptics = {
  /**
   * Light impact - subtle feedback for minor interactions
   * Use for: button presses, toggles, small selections
   */
  light: () => {
    if (isHapticsSupported) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  },

  /**
   * Medium impact - moderate feedback for standard interactions
   * Use for: dragging, menu selections, card interactions
   */
  medium: () => {
    if (isHapticsSupported) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  },

  /**
   * Heavy impact - strong feedback for significant actions
   * Use for: completing major actions, emphasis
   */
  heavy: () => {
    if (isHapticsSupported) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  },

  /**
   * Success notification - positive feedback
   * Use for: save success, entry creation, restore actions
   */
  success: () => {
    if (isHapticsSupported) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  },

  /**
   * Warning notification - cautionary feedback
   * Use for: delete actions, swipe-to-delete, destructive operations
   */
  warning: () => {
    if (isHapticsSupported) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  },

  /**
   * Error notification - negative feedback
   * Use for: validation errors, failed operations
   */
  error: () => {
    if (isHapticsSupported) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  },

  /**
   * Selection changed - light tick feedback
   * Use for: picker changes, slider movements, scrolling selections
   */
  selection: () => {
    if (isHapticsSupported) {
      Haptics.selectionAsync();
    }
  },
};

export default haptics;
