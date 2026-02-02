/**
 * Mood Scale Utilities
 * Functions for working with customizable mood scales
 */

import type {
  MoodScaleConfig,
  MoodLevelConfig,
  ProcessedMoodLevel,
  ProcessedMoodScale,
  PresetScaleId,
} from "@/types/moodScaleConfig";

// Default colors from the existing soft organic palette
const SCALE_COLORS = {
  sage: { bg: "#E8EFE8", text: "#476D47", bgDark: "#2D3D2D", textDark: "#A8C5A8" },
  sageLight: { bg: "#F4F7F4", text: "#476D47", bgDark: "#283328", textDark: "#7BA87B" },
  sageMedium: { bg: "#F4F7F4", text: "#5B8A5B", bgDark: "#252D25", textDark: "#A8C5A8" },
  dusk: { bg: "#EFECF2", text: "#695C78", bgDark: "#2D2A33", textDark: "#C4BBCF" },
  duskLight: { bg: "#F8F7F9", text: "#6B5C7A", bgDark: "#28252D", textDark: "#A396B3" },
  sand: { bg: "#F9F5ED", text: "#7A6545", bgDark: "#302A22", textDark: "#D4C4A0" },
  sandLight: { bg: "#FDFBF7", text: "#8B7352", bgDark: "#352D22", textDark: "#D4C4A0" },
  coral: { bg: "#FDE8E4", text: "#E06B55", bgDark: "#3D2822", textDark: "#F5A899" },
  coralLight: { bg: "#FEF6F4", text: "#E06B55", bgDark: "#3A2520", textDark: "#ED8370" },
  coralDark: { bg: "#FDE8E4", text: "#C75441", bgDark: "#3D221D", textDark: "#E06B55" },
  coralDeep: { bg: "#FACFC7", text: "#C75441", bgDark: "#401F1A", textDark: "#ED8370" },
};

/**
 * Default 0-10 mood scale (matches existing moodScale.ts)
 */
export const DEFAULT_SCALE_LEVELS: MoodLevelConfig[] = [
  { value: 0, label: "Elated", description: "Overjoyed, unstoppable energy", colorHex: SCALE_COLORS.sage.bg, textHex: SCALE_COLORS.sage.text, colorHexDark: SCALE_COLORS.sage.bgDark, textHexDark: SCALE_COLORS.sage.textDark },
  { value: 1, label: "Very Happy", description: "High spirits, confident and upbeat", colorHex: SCALE_COLORS.sageLight.bg, textHex: SCALE_COLORS.sageLight.text, colorHexDark: SCALE_COLORS.sageLight.bgDark, textHexDark: SCALE_COLORS.sageLight.textDark },
  { value: 2, label: "Good", description: "Content, minor worries fade quickly", colorHex: SCALE_COLORS.sageMedium.bg, textHex: SCALE_COLORS.sageMedium.text, colorHexDark: SCALE_COLORS.sageMedium.bgDark, textHexDark: SCALE_COLORS.sageMedium.textDark },
  { value: 3, label: "Positive", description: "Generally fine, occasional stress", colorHex: SCALE_COLORS.dusk.bg, textHex: SCALE_COLORS.dusk.text, colorHexDark: SCALE_COLORS.dusk.bgDark, textHexDark: SCALE_COLORS.dusk.textDark },
  { value: 4, label: "Okay", description: "Some good moments, average day", colorHex: SCALE_COLORS.duskLight.bg, textHex: SCALE_COLORS.duskLight.text, colorHexDark: SCALE_COLORS.duskLight.bgDark, textHexDark: SCALE_COLORS.duskLight.textDark },
  { value: 5, label: "Neutral", description: "Neither good nor bad", colorHex: SCALE_COLORS.sand.bg, textHex: SCALE_COLORS.sand.text, colorHexDark: SCALE_COLORS.sand.bgDark, textHexDark: SCALE_COLORS.sand.textDark },
  { value: 6, label: "Low", description: "Motivation dipping; tasks feel harder", colorHex: SCALE_COLORS.sandLight.bg, textHex: SCALE_COLORS.sandLight.text, colorHexDark: SCALE_COLORS.sandLight.bgDark, textHexDark: SCALE_COLORS.sandLight.textDark },
  { value: 7, label: "Struggling", description: "Intense distress; trouble reaching out", colorHex: SCALE_COLORS.coral.bg, textHex: SCALE_COLORS.coral.text, colorHexDark: SCALE_COLORS.coral.bgDark, textHexDark: SCALE_COLORS.coral.textDark },
  { value: 8, label: "Overwhelmed", description: "Unable to function; tasks feel impossible", colorHex: SCALE_COLORS.coralLight.bg, textHex: SCALE_COLORS.coralLight.text, colorHexDark: SCALE_COLORS.coralLight.bgDark, textHexDark: SCALE_COLORS.coralLight.textDark },
  { value: 9, label: "Crisis", description: "Strong urge to end life; thoughts of action", colorHex: SCALE_COLORS.coralDark.bg, textHex: SCALE_COLORS.coralDark.text, colorHexDark: SCALE_COLORS.coralDark.bgDark, textHexDark: SCALE_COLORS.coralDark.textDark },
  { value: 10, label: "Emergency", description: "Taking steps toward self-harm", colorHex: SCALE_COLORS.coralDeep.bg, textHex: SCALE_COLORS.coralDeep.text, colorHexDark: SCALE_COLORS.coralDeep.bgDark, textHexDark: SCALE_COLORS.coralDeep.textDark },
];

/**
 * 5-level scale for simpler tracking
 */
export const FIVE_LEVEL_SCALE_LEVELS: MoodLevelConfig[] = [
  { value: 0, label: "Great", description: "Feeling wonderful", colorHex: SCALE_COLORS.sage.bg, textHex: SCALE_COLORS.sage.text, colorHexDark: SCALE_COLORS.sage.bgDark, textHexDark: SCALE_COLORS.sage.textDark },
  { value: 1, label: "Good", description: "Feeling positive", colorHex: SCALE_COLORS.sageMedium.bg, textHex: SCALE_COLORS.sageMedium.text, colorHexDark: SCALE_COLORS.sageMedium.bgDark, textHexDark: SCALE_COLORS.sageMedium.textDark },
  { value: 2, label: "Okay", description: "Feeling neutral", colorHex: SCALE_COLORS.sand.bg, textHex: SCALE_COLORS.sand.text, colorHexDark: SCALE_COLORS.sand.bgDark, textHexDark: SCALE_COLORS.sand.textDark },
  { value: 3, label: "Low", description: "Feeling down", colorHex: SCALE_COLORS.coral.bg, textHex: SCALE_COLORS.coral.text, colorHexDark: SCALE_COLORS.coral.bgDark, textHexDark: SCALE_COLORS.coral.textDark },
  { value: 4, label: "Bad", description: "Struggling significantly", colorHex: SCALE_COLORS.coralDeep.bg, textHex: SCALE_COLORS.coralDeep.text, colorHexDark: SCALE_COLORS.coralDeep.bgDark, textHexDark: SCALE_COLORS.coralDeep.textDark },
];

/**
 * 5-level emoji scale
 */
export const EMOJI_FIVE_LEVEL_SCALE_LEVELS: MoodLevelConfig[] = [
  { value: 0, label: "Great", description: "Feeling wonderful", emoji: "😄", colorHex: SCALE_COLORS.sage.bg, textHex: SCALE_COLORS.sage.text, colorHexDark: SCALE_COLORS.sage.bgDark, textHexDark: SCALE_COLORS.sage.textDark },
  { value: 1, label: "Good", description: "Feeling positive", emoji: "🙂", colorHex: SCALE_COLORS.sageMedium.bg, textHex: SCALE_COLORS.sageMedium.text, colorHexDark: SCALE_COLORS.sageMedium.bgDark, textHexDark: SCALE_COLORS.sageMedium.textDark },
  { value: 2, label: "Okay", description: "Feeling neutral", emoji: "😐", colorHex: SCALE_COLORS.sand.bg, textHex: SCALE_COLORS.sand.text, colorHexDark: SCALE_COLORS.sand.bgDark, textHexDark: SCALE_COLORS.sand.textDark },
  { value: 3, label: "Low", description: "Feeling down", emoji: "😔", colorHex: SCALE_COLORS.coral.bg, textHex: SCALE_COLORS.coral.text, colorHexDark: SCALE_COLORS.coral.bgDark, textHexDark: SCALE_COLORS.coral.textDark },
  { value: 4, label: "Bad", description: "Struggling significantly", emoji: "😢", colorHex: SCALE_COLORS.coralDeep.bg, textHex: SCALE_COLORS.coralDeep.text, colorHexDark: SCALE_COLORS.coralDeep.bgDark, textHexDark: SCALE_COLORS.coralDeep.textDark },
];

/**
 * Get the default mood scale configuration
 */
export function getDefaultMoodScaleConfig(): MoodScaleConfig {
  return {
    id: "default-0-10",
    name: "Default (0-10)",
    scaleType: "discrete",
    displayStyle: "numeric",
    scaleLabel: "Mood",
    levels: DEFAULT_SCALE_LEVELS,
    lowerIsBetter: true,
    isCustom: false,
  };
}

/**
 * Get all preset scale configurations
 */
export function getPresetScaleConfigs(): Record<PresetScaleId, MoodScaleConfig> {
  return {
    "default-0-10": getDefaultMoodScaleConfig(),
    "five-level": {
      id: "five-level",
      name: "5-Level Scale",
      scaleType: "discrete",
      displayStyle: "numeric",
      scaleLabel: "Mood",
      levels: FIVE_LEVEL_SCALE_LEVELS,
      lowerIsBetter: true,
      isCustom: false,
    },
    "emoji-five-level": {
      id: "emoji-five-level",
      name: "Emoji Scale",
      scaleType: "discrete",
      displayStyle: "emoji",
      scaleLabel: "Mood",
      levels: EMOJI_FIVE_LEVEL_SCALE_LEVELS,
      lowerIsBetter: true,
      isCustom: false,
    },
    "slider-1-100": {
      id: "slider-1-100",
      name: "1-100 Slider",
      scaleType: "slider",
      displayStyle: "numeric",
      scaleLabel: "Mood",
      slider: {
        min: 1,
        max: 100,
        step: 1,
        gradientStartHex: SCALE_COLORS.sage.bg,
        gradientEndHex: SCALE_COLORS.coralDeep.bg,
        gradientStartHexDark: SCALE_COLORS.sage.bgDark,
        gradientEndHexDark: SCALE_COLORS.coralDeep.bgDark,
      },
      lowerIsBetter: true,
      isCustom: false,
    },
  };
}

/**
 * Get scale range (min, max)
 */
export function getScaleRange(config: MoodScaleConfig): { min: number; max: number; step: number } {
  if (config.scaleType === "slider" && config.slider) {
    return {
      min: config.slider.min,
      max: config.slider.max,
      step: config.slider.step,
    };
  }

  if (config.levels && config.levels.length > 0) {
    const values = config.levels.map((l) => l.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      step: 1,
    };
  }

  return { min: 0, max: 10, step: 1 };
}

/**
 * Linear interpolation between two colors
 */
function interpolateColor(color1: string, color2: string, factor: number): string {
  const hex1 = color1.replace("#", "");
  const hex2 = color2.replace("#", "");

  const r1 = parseInt(hex1.substring(0, 2), 16);
  const g1 = parseInt(hex1.substring(2, 4), 16);
  const b1 = parseInt(hex1.substring(4, 6), 16);

  const r2 = parseInt(hex2.substring(0, 2), 16);
  const g2 = parseInt(hex2.substring(2, 4), 16);
  const b2 = parseInt(hex2.substring(4, 6), 16);

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Get interpolated color for slider value
 */
export function getSliderColor(
  value: number,
  config: MoodScaleConfig,
  isDark: boolean
): { bg: string; text: string } {
  if (!config.slider) {
    return { bg: "#E8EFE8", text: "#476D47" };
  }

  const { min, max, gradientStartHex, gradientEndHex, gradientStartHexDark, gradientEndHexDark } =
    config.slider;

  const factor = (value - min) / (max - min);
  const startColor = isDark && gradientStartHexDark ? gradientStartHexDark : gradientStartHex;
  const endColor = isDark && gradientEndHexDark ? gradientEndHexDark : gradientEndHex;

  const bg = interpolateColor(startColor, endColor, factor);
  // Text color: darker version of bg or white if dark mode
  const text = isDark ? "#F5F1E8" : "#3D352A";

  return { bg, text };
}

/**
 * Get mood info for a given value based on scale config
 */
export function getMoodInfo(
  value: number,
  config: MoodScaleConfig,
  isDark: boolean = false
): ProcessedMoodLevel {
  // For slider scales, generate interpolated color
  if (config.scaleType === "slider" && config.slider) {
    const colors = getSliderColor(value, config, isDark);
    const { min, max } = config.slider;
    const percentage = Math.round(((value - min) / (max - min)) * 100);

    return {
      value,
      label: `${value}`,
      description: `${percentage}% on scale`,
      bgHex: colors.bg,
      textHex: colors.text,
      bgHexDark: colors.bg,
      textHexDark: colors.text,
      borderColor: colors.bg,
    };
  }

  // For discrete scales, find the closest level
  if (!config.levels || config.levels.length === 0) {
    // Fallback to default
    const defaultLevel = DEFAULT_SCALE_LEVELS[Math.min(Math.max(0, Math.round(value)), 10)];
    return {
      value: defaultLevel.value,
      label: defaultLevel.label,
      description: defaultLevel.description || "",
      bgHex: defaultLevel.colorHex,
      textHex: defaultLevel.textHex,
      bgHexDark: defaultLevel.colorHexDark || defaultLevel.colorHex,
      textHexDark: defaultLevel.textHexDark || defaultLevel.textHex,
      borderColor: defaultLevel.colorHex,
    };
  }

  // Find exact match or closest level
  let level = config.levels.find((l) => l.value === value);

  if (!level) {
    // Find closest
    level = config.levels.reduce((closest, current) => {
      return Math.abs(current.value - value) < Math.abs(closest.value - value) ? current : closest;
    });
  }

  return {
    value: level.value,
    label: level.label,
    description: level.description || "",
    emoji: level.emoji,
    bgHex: level.colorHex,
    textHex: level.textHex,
    bgHexDark: level.colorHexDark || level.colorHex,
    textHexDark: level.textHexDark || level.textHex,
    borderColor: level.colorHex,
  };
}

/**
 * Build processed mood scale for UI usage
 */
export function buildMoodScale(config: MoodScaleConfig): ProcessedMoodScale {
  const range = getScaleRange(config);
  const levels: ProcessedMoodLevel[] = [];

  if (config.scaleType === "slider" && config.slider) {
    // For slider, generate representative levels for charts/display
    const numSamples = Math.min(11, Math.ceil((range.max - range.min) / range.step));
    for (let i = 0; i < numSamples; i++) {
      const value = range.min + ((range.max - range.min) * i) / (numSamples - 1);
      levels.push(getMoodInfo(Math.round(value), config, false));
    }
  } else if (config.levels) {
    // For discrete, use all defined levels
    for (const level of config.levels.sort((a, b) => a.value - b.value)) {
      levels.push({
        value: level.value,
        label: level.label,
        description: level.description || "",
        emoji: level.emoji,
        bgHex: level.colorHex,
        textHex: level.textHex,
        bgHexDark: level.colorHexDark || level.colorHex,
        textHexDark: level.textHexDark || level.textHex,
        borderColor: level.colorHex,
      });
    }
  }

  return {
    config,
    levels,
    min: range.min,
    max: range.max,
    step: range.step,
  };
}

/**
 * Map a value from one scale range to another (linear remapping)
 */
export function mapValueBetweenRanges(
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number
): number {
  if (fromMax === fromMin) return toMin;

  const normalized = (value - fromMin) / (fromMax - fromMin);
  const mapped = toMin + normalized * (toMax - toMin);

  // Round to nearest integer
  return Math.round(mapped);
}

/**
 * Get color gradient array for charts
 */
export function getGradientColors(config: MoodScaleConfig, isDark: boolean = false): string[] {
  if (config.scaleType === "slider" && config.slider) {
    const colors: string[] = [];
    const numColors = 11;
    for (let i = 0; i < numColors; i++) {
      const value = config.slider.min + ((config.slider.max - config.slider.min) * i) / (numColors - 1);
      const colorInfo = getSliderColor(value, config, isDark);
      colors.push(colorInfo.bg);
    }
    return colors;
  }

  if (!config.levels || config.levels.length === 0) {
    return DEFAULT_SCALE_LEVELS.map((l) =>
      isDark ? l.colorHexDark || l.colorHex : l.colorHex
    );
  }

  return config.levels
    .sort((a, b) => a.value - b.value)
    .map((l) => (isDark ? l.colorHexDark || l.colorHex : l.colorHex));
}

/**
 * Validate a mood scale configuration
 */
export function validateMoodScaleConfig(config: MoodScaleConfig): { valid: boolean; error?: string } {
  if (!config.id || !config.name) {
    return { valid: false, error: "Scale must have an ID and name" };
  }

  if (config.scaleType === "discrete") {
    if (!config.levels || config.levels.length < 2) {
      return { valid: false, error: "Discrete scale must have at least 2 levels" };
    }

    const values = config.levels.map((l) => l.value);
    if (new Set(values).size !== values.length) {
      return { valid: false, error: "All mood levels must have unique values" };
    }

    for (const level of config.levels) {
      if (!level.label || level.label.trim() === "") {
        return { valid: false, error: "All mood levels must have labels" };
      }
      if (!level.colorHex || !level.textHex) {
        return { valid: false, error: "All mood levels must have colors defined" };
      }
    }
  }

  if (config.scaleType === "slider") {
    if (!config.slider) {
      return { valid: false, error: "Slider scale must have slider configuration" };
    }
    if (config.slider.min >= config.slider.max) {
      return { valid: false, error: "Slider min must be less than max" };
    }
    if (config.slider.step <= 0) {
      return { valid: false, error: "Slider step must be positive" };
    }
  }

  return { valid: true };
}

/**
 * Create a copy of a scale config with a new ID (for user customization)
 */
export function cloneScaleConfig(config: MoodScaleConfig, newId: string, newName: string): MoodScaleConfig {
  return {
    ...config,
    id: newId,
    name: newName,
    isCustom: true,
    levels: config.levels ? [...config.levels.map((l) => ({ ...l }))] : undefined,
    slider: config.slider ? { ...config.slider } : undefined,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };
}

/**
 * Color palette options for user customization
 */
export const COLOR_PALETTE = [
  { name: "Sage", bg: "#E8EFE8", text: "#476D47", bgDark: "#2D3D2D", textDark: "#A8C5A8" },
  { name: "Sage Light", bg: "#F4F7F4", text: "#5B8A5B", bgDark: "#252D25", textDark: "#A8C5A8" },
  { name: "Dusk", bg: "#EFECF2", text: "#695C78", bgDark: "#2D2A33", textDark: "#C4BBCF" },
  { name: "Dusk Light", bg: "#F8F7F9", text: "#6B5C7A", bgDark: "#28252D", textDark: "#A396B3" },
  { name: "Sand", bg: "#F9F5ED", text: "#7A6545", bgDark: "#302A22", textDark: "#D4C4A0" },
  { name: "Sand Light", bg: "#FDFBF7", text: "#8B7352", bgDark: "#352D22", textDark: "#D4C4A0" },
  { name: "Coral", bg: "#FDE8E4", text: "#E06B55", bgDark: "#3D2822", textDark: "#F5A899" },
  { name: "Coral Light", bg: "#FEF6F4", text: "#E06B55", bgDark: "#3A2520", textDark: "#ED8370" },
  { name: "Coral Dark", bg: "#FACFC7", text: "#C75441", bgDark: "#401F1A", textDark: "#ED8370" },
  { name: "Blue", bg: "#E3EEF9", text: "#4A7BA7", bgDark: "#252D35", textDark: "#7BA8CF" },
  { name: "Yellow", bg: "#FDF6E3", text: "#B58900", bgDark: "#352D1A", textDark: "#D4A800" },
  { name: "Purple", bg: "#F3E8F9", text: "#7B4A9E", bgDark: "#2D2535", textDark: "#B892CF" },
];
