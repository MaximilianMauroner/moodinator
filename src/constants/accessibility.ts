/**
 * Accessibility constants for the Moodinator app.
 * Provides consistent labels and hints for screen readers.
 */

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
  return "Tap to choose this mood, long press for detailed entry";
}

/**
 * Tab bar accessibility labels.
 */
export const TAB_ACCESSIBILITY_LABELS = {
  today: "Today tab, log your mood",
  history: "History tab, view past days and months",
  insights: "Insights tab, view mood patterns and summaries",
} as const;

/**
 * Get accessibility label for a mood list item.
 */
export function getMoodItemLabel(
  moodValue: number,
  moodLabel: string,
  dateLabel: string,
  timeLabel: string,
): string {
  return `Mood entry: ${moodLabel} (${moodValue}), logged on ${dateLabel} at ${timeLabel}`;
}

/**
 * Get accessibility hint for a mood list item.
 */
export function getMoodItemHint(): string {
  return "Tap for details. Use the actions button to edit, change date and time, or delete";
}

/**
 * Energy level accessibility labels.
 */
export function getEnergyLevelLabel(value: number, isSelected: boolean): string {
  const selectionStatus = isSelected ? "selected" : "";
  return `Energy level ${value} out of 10${selectionStatus ? ", " + selectionStatus : ""}`;
}

/**
 * Common button accessibility hints.
 */
export const BUTTON_HINTS = {
  save: "Tap to save your changes",
} as const;

/**
 * Settings accessibility labels.
 */
export const SETTINGS_ACCESSIBILITY = {
  toggleHint: (isEnabled: boolean) =>
    `Tap to ${isEnabled ? "disable" : "enable"} this setting`,
} as const;
