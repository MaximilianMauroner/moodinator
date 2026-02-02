/**
 * useMoodScale Hook
 * Provides access to the current mood scale configuration and utilities
 */

import { useMemo, useCallback } from "react";
import { useColorScheme } from "nativewind";
import { useSettingsStore } from "@/shared/state/settingsStore";
import type { MoodScaleConfig, ProcessedMoodLevel, ProcessedMoodScale } from "@/types/moodScaleConfig";
import {
  getDefaultMoodScaleConfig,
  buildMoodScale,
  getMoodInfo,
  getGradientColors,
  getScaleRange,
  mapValueBetweenRanges,
} from "@/lib/moodScaleUtils";

export interface UseMoodScaleReturn {
  /** The current scale configuration */
  config: MoodScaleConfig;

  /** Processed scale with all levels ready for UI */
  scale: ProcessedMoodScale;

  /** Scale label (e.g., "Mood", "Wellbeing") */
  scaleLabel: string;

  /** Whether the scale uses discrete buttons or a slider */
  isDiscreteScale: boolean;

  /** Whether the scale uses emoji display */
  isEmojiScale: boolean;

  /** Scale range */
  min: number;
  max: number;
  step: number;

  /** Get mood info for a specific value */
  getMoodInfo: (value: number) => ProcessedMoodLevel;

  /** Get the label for a mood value */
  getMoodLabel: (value: number) => string;

  /** Get the color for a mood value */
  getMoodColor: (value: number) => string;

  /** Get gradient colors for charts */
  getGradientColors: () => string[];

  /** Get all scale levels (for buttons) */
  getLevels: () => ProcessedMoodLevel[];

  /** Map value from one range to another */
  mapValue: (value: number, fromMin: number, fromMax: number, toMin: number, toMax: number) => number;
}

/**
 * Hook to access the current mood scale configuration and utilities
 */
export function useMoodScale(): UseMoodScaleReturn {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Get mood scale config from settings store
  const moodScaleConfig = useSettingsStore((state) => state.moodScaleConfig);

  // Use default if not configured
  const config = useMemo(() => {
    return moodScaleConfig || getDefaultMoodScaleConfig();
  }, [moodScaleConfig]);

  // Build processed scale
  const scale = useMemo(() => buildMoodScale(config), [config]);

  // Scale range
  const range = useMemo(() => getScaleRange(config), [config]);

  // Get mood info for a value
  const getMoodInfoForValue = useCallback(
    (value: number): ProcessedMoodLevel => {
      return getMoodInfo(value, config, isDark);
    },
    [config, isDark]
  );

  // Get mood label
  const getMoodLabel = useCallback(
    (value: number): string => {
      const info = getMoodInfo(value, config, isDark);
      return info.label;
    },
    [config, isDark]
  );

  // Get mood color
  const getMoodColor = useCallback(
    (value: number): string => {
      const info = getMoodInfo(value, config, isDark);
      return isDark ? info.textHexDark : info.textHex;
    },
    [config, isDark]
  );

  // Get gradient colors for charts
  const getGradientColorsForCharts = useCallback((): string[] => {
    return getGradientColors(config, isDark);
  }, [config, isDark]);

  // Get all levels
  const getLevels = useCallback((): ProcessedMoodLevel[] => {
    return scale.levels;
  }, [scale]);

  // Map value between ranges
  const mapValue = useCallback(
    (value: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number => {
      return mapValueBetweenRanges(value, fromMin, fromMax, toMin, toMax);
    },
    []
  );

  return {
    config,
    scale,
    scaleLabel: config.scaleLabel,
    isDiscreteScale: config.scaleType === "discrete",
    isEmojiScale: config.displayStyle === "emoji" || config.displayStyle === "both",
    min: range.min,
    max: range.max,
    step: range.step,
    getMoodInfo: getMoodInfoForValue,
    getMoodLabel,
    getMoodColor,
    getGradientColors: getGradientColorsForCharts,
    getLevels,
    mapValue,
  };
}

export default useMoodScale;
