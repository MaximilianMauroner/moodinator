/**
 * Mood Scale Configuration Types
 * Supports customizable mood scales with different display styles
 */

export type ScaleType = "discrete" | "slider";

export type DisplayStyle = "numeric" | "emoji" | "both";

/**
 * Configuration for a single mood level in a discrete scale
 */
export interface MoodLevelConfig {
  value: number;
  label: string;
  description?: string;
  emoji?: string;
  colorHex: string; // Background color
  textHex: string; // Text color
  colorHexDark?: string; // Background color for dark mode
  textHexDark?: string; // Text color for dark mode
}

/**
 * Configuration for a slider scale (continuous range)
 */
export interface SliderConfig {
  min: number;
  max: number;
  step: number;
  gradientStartHex: string;
  gradientEndHex: string;
  gradientStartHexDark?: string;
  gradientEndHexDark?: string;
}

/**
 * Full mood scale configuration
 */
export interface MoodScaleConfig {
  id: string;
  name: string;
  scaleType: ScaleType;
  displayStyle: DisplayStyle;
  scaleLabel: string; // e.g., "Mood", "Wellbeing", "Energy"

  // For discrete scales
  levels?: MoodLevelConfig[];

  // For slider scales
  slider?: SliderConfig;

  // Scale orientation: lower is better (0 = best) or higher is better (10 = best)
  lowerIsBetter: boolean;

  // Custom flag to differentiate user-created from presets
  isCustom: boolean;

  // Timestamps
  createdAt?: number;
  modifiedAt?: number;
}

/**
 * Preset scale identifiers
 */
export type PresetScaleId =
  | "default-0-10"
  | "five-level"
  | "emoji-five-level"
  | "slider-1-100";

/**
 * Result of processing mood scale for UI usage
 */
export interface ProcessedMoodLevel {
  value: number;
  label: string;
  description: string;
  emoji?: string;
  bgHex: string;
  textHex: string;
  bgHexDark: string;
  textHexDark: string;
  borderColor: string;
}

/**
 * Mood scale with all processed levels ready for UI
 */
export interface ProcessedMoodScale {
  config: MoodScaleConfig;
  levels: ProcessedMoodLevel[];
  min: number;
  max: number;
  step: number;
}
