/**
 * Shared utility functions for emotion category colors
 */

export type EmotionColorScheme = {
  bg: string;
  text: string;
  border?: string;
  selected?: string;
  unselected?: string;
};

/**
 * Returns the color scheme for a given emotion category.
 * Used across multiple components for consistent color-coding.
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
          selected: "bg-green-600 border-green-600",
          unselected:
            "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700",
        };
      }
      return {
        bg: "bg-green-100 dark:bg-green-900/30",
        border: "border-green-200 dark:border-green-700",
        text: "text-green-700 dark:text-green-300",
      };
    case "negative":
      if (variant === "button") {
        return {
          bg: "",
          text: "",
          selected: "bg-red-600 border-red-600",
          unselected:
            "bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700",
        };
      }
      return {
        bg: "bg-red-100 dark:bg-red-900/30",
        border: "border-red-200 dark:border-red-700",
        text: "text-red-700 dark:text-red-300",
      };
    case "neutral":
    default:
      if (variant === "button") {
        return {
          bg: "",
          text: "",
          selected: "bg-slate-600 border-slate-600",
          unselected:
            "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700",
        };
      }
      return {
        bg: "bg-slate-100 dark:bg-slate-800",
        border: "border-slate-200 dark:border-slate-700",
        text: "text-slate-700 dark:text-slate-300",
      };
  }
}

/**
 * Returns the icon color for a given emotion category.
 * Used for consistent icon colors matching the category theme.
 */
export function getCategoryIconColor(category: string): string {
  switch (category) {
    case "positive":
      return "#22c55e"; // green-500
    case "negative":
      return "#ef4444"; // red-500
    case "neutral":
    default:
      return "#94a3b8"; // slate-400
  }
}
