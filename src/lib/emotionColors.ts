/**
 * Shared utility functions for emotion category colors
 * These functions provide Tailwind class names for styling.
 * For hex color values, use the colors from @/constants/colors instead.
 */

import { colors } from "@/constants/colors";

export type EmotionColorScheme = {
  bg: string;
  text: string;
  border?: string;
  selected?: string;
  unselected?: string;
};

/**
 * Returns the Tailwind class scheme for a given emotion category.
 * Used across multiple components for consistent color-coding with Tailwind classes.
 * For hex values, use useThemeColors().getCategoryColors() instead.
 */
export function getCategoryColors(
  category: string,
  variant: "badge" | "button" = "badge"
): EmotionColorScheme {
  switch (category) {
    case "positive":
      if (variant === "button") {
        return {
          bg: "",
          text: "",
          selected: "bg-sage-500 border-sage-500",
          unselected:
            "bg-sage-50 dark:bg-sage-600/20 border-sage-300 dark:border-sage-700",
        };
      }
      return {
        bg: "bg-sage-100 dark:bg-sage-600/20",
        border: "border-sage-200 dark:border-sage-700",
        text: "text-sage-600 dark:text-sage-300",
      };
    case "negative":
      if (variant === "button") {
        return {
          bg: "",
          text: "",
          selected: "bg-coral-500 border-coral-500",
          unselected:
            "bg-coral-50 dark:bg-coral-600/20 border-coral-300 dark:border-coral-700",
        };
      }
      return {
        bg: "bg-coral-100 dark:bg-coral-600/20",
        border: "border-coral-200 dark:border-coral-700",
        text: "text-coral-600 dark:text-coral-300",
      };
    case "neutral":
    default:
      if (variant === "button") {
        return {
          bg: "",
          text: "",
          selected: "bg-dusk-500 border-dusk-500",
          unselected:
            "bg-dusk-50 dark:bg-dusk-700 border-dusk-300 dark:border-dusk-600",
        };
      }
      return {
        bg: "bg-dusk-100 dark:bg-dusk-800",
        border: "border-dusk-200 dark:border-dusk-700",
        text: "text-dusk-600 dark:text-dusk-300",
      };
  }
}

/**
 * Returns the icon color (hex) for a given emotion category.
 * Used for consistent icon colors matching the category theme.
 */
export function getCategoryIconColor(category: string, isDark: boolean = false): string {
  switch (category) {
    case "positive":
      return isDark ? colors.positive.text.dark : colors.positive.text.light;
    case "negative":
      return isDark ? colors.negative.text.dark : colors.negative.text.light;
    case "neutral":
    default:
      return isDark ? colors.neutral.text.dark : colors.neutral.text.light;
  }
}
