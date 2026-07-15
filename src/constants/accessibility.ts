/**
 * Accessibility constants for the Moodinator app.
 * Provides consistent labels and hints for screen readers.
 */

/**
 * Mood level accessibility labels.
 * Maps numeric mood values (0-10) to descriptive labels.
 */
export const MOOD_ACCESSIBILITY_LABELS: Record<number, string> = {
  0: "Elated, best possible",
  1: "Very Happy, high spirits",
  2: "Good, feeling well",
  3: "Positive, generally fine",
  4: "Okay, some good moments",
  5: "Neutral, neither good nor bad",
  6: "Low, motivation dipping",
  7: "Struggling, intense distress",
  8: "Overwhelmed, tasks feel impossible",
  9: "Crisis, needs support",
  10: "Emergency, needs immediate support",
};

/**
 * Get accessibility label for a mood button.
 */
export function getMoodButtonLabel(moodValue: number, moodLabel: string): string {
  return `Mood Rating ${moodValue} of 10, ${moodLabel}. Lower numbers are better.`;
}

/**
 * Get accessibility hint for a mood button.
 */
export function getMoodButtonHint(): string {
  return "Tap to log this mood quickly, long press for detailed entry";
}

/**
 * Tab bar accessibility labels.
 */
export const TAB_ACCESSIBILITY_LABELS = {
  home: "Home tab, log your mood",
  insights: "Insights tab, view mood charts and analytics",
  settings: "Settings tab, customize app preferences",
} as const;

/**
 * Get accessibility label for a mood list item.
 */
export function getMoodItemLabel(
  moodValue: number,
  moodLabel: string,
  timestamp: Date
): string {
  const timeStr = timestamp.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = timestamp.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `Mood entry: ${moodLabel} (${moodValue}), logged on ${dateStr} at ${timeStr}`;
}

/**
 * Get accessibility hint for a mood list item.
 */
export function getMoodItemHint(): string {
  return "Tap for details. Use the actions button to edit, change date and time, or delete";
}

/**
 * Emotion category accessibility labels.
 */
export const EMOTION_CATEGORY_LABELS = {
  positive: "Positive emotion",
  neutral: "Neutral emotion",
  negative: "Negative emotion",
} as const;

/**
 * Get accessibility label for an emotion chip.
 */
export function getEmotionChipLabel(
  emotionName: string,
  category: "positive" | "neutral" | "negative",
  isSelected: boolean
): string {
  const selectionStatus = isSelected ? "selected" : "not selected";
  return `${emotionName}, ${EMOTION_CATEGORY_LABELS[category]}, ${selectionStatus}`;
}

/**
 * Get accessibility hint for an emotion chip.
 */
export function getEmotionChipHint(isSelected: boolean): string {
  return isSelected ? "Tap to deselect this emotion" : "Tap to select this emotion";
}

/**
 * Energy level accessibility labels.
 */
export function getEnergyLevelLabel(value: number, isSelected: boolean): string {
  const selectionStatus = isSelected ? "selected" : "";
  return `Energy level ${value} out of 10${selectionStatus ? ", " + selectionStatus : ""}`;
}

/**
 * Modal accessibility properties.
 */
export const MODAL_ACCESSIBILITY = {
  moodEntry: {
    label: "Mood entry form",
    hint: "Fill in the form to log your mood entry",
  },
  datePicker: {
    label: "Date and time picker",
    hint: "Change the date and time for this mood entry",
  },
} as const;

/**
 * Common button accessibility hints.
 */
export const BUTTON_HINTS = {
  save: "Tap to save your changes",
  cancel: "Tap to cancel and close",
  delete: "Tap to delete this item",
  edit: "Tap to edit this item",
  add: "Tap to add a new item",
  refresh: "Tap to refresh the data",
  clear: "Tap to clear this selection",
  undo: "Tap to undo the last action",
  goBack: "Tap to go back to the previous screen",
} as const;

/**
 * Settings accessibility labels.
 */
export const SETTINGS_ACCESSIBILITY = {
  toggle: (isEnabled: boolean, settingName: string) =>
    `${settingName}, ${isEnabled ? "enabled" : "disabled"}`,
  toggleHint: (isEnabled: boolean) =>
    `Tap to ${isEnabled ? "disable" : "enable"} this setting`,
} as const;

/**
 * Chart accessibility labels and helpers.
 */
export const CHART_ACCESSIBILITY = {
  moodChart: {
    label: (period: string, dataPointCount: number) =>
      `Mood chart for ${period} with ${dataPointCount} data points`,
    hint: "Shows mood trends over time",
  },
  dataPoint: {
    label: (date: string, value: number, moodLabel?: string) =>
      `${date}: mood ${value}${moodLabel ? `, ${moodLabel}` : ""}`,
  },
  trend: {
    label: (direction: "improving" | "declining" | "stable", percentChange?: number) => {
      if (direction === "stable") {
        return "Mood trend is stable";
      }
      const changeText = percentChange !== undefined ? ` by ${Math.abs(percentChange).toFixed(1)}%` : "";
      return `Mood is ${direction}${changeText}`;
    },
  },
  weeklyComparison: {
    label: (currentAvg: number, lastWeekAvg: number) =>
      `This week average: ${currentAvg.toFixed(1)}, last week average: ${lastWeekAvg.toFixed(1)}`,
  },
  overview: {
    label: (totalEntries: number, overallAvg: number) =>
      `Overview: ${totalEntries} total entries with average mood of ${overallAvg.toFixed(1)} out of 10`,
  },
} as const;

/**
 * Get accessibility label for a chart based on its data.
 */
export function getChartAccessibilityLabel(
  chartType: "daily" | "weekly" | "overview" | "raw",
  dataPoints: number,
  period?: string
): string {
  const periodText = period || "selected period";
  switch (chartType) {
    case "daily":
      return `Daily mood chart showing ${dataPoints} days of data`;
    case "weekly":
      return `Weekly mood trends showing ${dataPoints} weeks of data`;
    case "overview":
      return `Mood overview chart for ${periodText}`;
    case "raw":
      return `Raw mood data timeline with ${dataPoints} entries`;
    default:
      return `Mood chart with ${dataPoints} data points`;
  }
}
