/**
 * Centralized theme colors for the Moodinator app
 * Soft Organic palette - warm, natural, cozy tones
 */

import { useColorScheme } from "@/hooks/useColorScheme";

export const colors = {
  // Background colors
  background: { light: "#FAF8F4", dark: "#1E2D26" },
  surface: { light: "#FDFCFA", dark: "#2C4038" },
  surfaceAlt: { light: "#F5F1E8", dark: "#364C44" },
  surfaceElevated: { light: "#F9F5ED", dark: "#3E564E" },

  // Text colors
  text: { light: "#3D352A", dark: "#F0EDE6" },
  textMuted: { light: "#5C4E3D", dark: "#C4AA80" },
  textSubtle: { light: "#7A6B55", dark: "#D4C49C" },
  textInverse: { light: "#FFFFFF", dark: "#FFFFFF" },

  // Primary accent (sage green)
  primary: { light: "#5B8A5B", dark: "#7BA87B" },
  primaryMuted: { light: "#7BA87B", dark: "#A8C5A8" },
  primaryBg: { light: "#E8EFE8", dark: "#2C4A34" },
  primaryBgHover: { light: "#D1DFD1", dark: "#385440" },

  // Border colors
  border: { light: "#E5D9BF", dark: "#3A5448" },
  borderSubtle: { light: "#F2EBD9", dark: "#2E4438" },

  // Overlay
  overlay: "rgba(0,0,0,0.4)",

  // Category colors - for emotions and tags
  positive: {
    bg: { light: "#E8EFE8", dark: "#2C4A34" },
    bgSelected: { light: "#5B8A5B", dark: "#5B8A5B" },
    border: { light: "#D1DFD1", dark: "#3A5A42" },
    text: { light: "#5B8A5B", dark: "#A8C5A8" },
    textSelected: { light: "#FFFFFF", dark: "#FFFFFF" },
    textDark: { light: "#476D47", dark: "#A8C5A8" },
  },
  negative: {
    bg: { light: "#FDE8E4", dark: "#472E2A" },
    bgSelected: { light: "#E06B55", dark: "#C75441" },
    border: { light: "#FACFC7", dark: "#573A36" },
    text: { light: "#C75441", dark: "#F5A899" },
    textSelected: { light: "#FFFFFF", dark: "#FFFFFF" },
  },
  neutral: {
    bg: { light: "#EFECF2", dark: "#36344A" },
    bgSelected: { light: "#847596", dark: "#695C78" },
    border: { light: "#DDD8E5", dark: "#44425A" },
    text: { light: "#695C78", dark: "#C4BBCF" },
    textSelected: { light: "#FFFFFF", dark: "#FFFFFF" },
  },

  // Sand/warm tones (for energy, timestamps, etc.)
  sand: {
    bg: { light: "#F9F5ED", dark: "#3E3E30" },
    bgSelected: { light: "#9D8660", dark: "#BDA77D" },
    bgHover: { light: "#FDF8EF", dark: "#3E5448" },
    border: { light: "#E5D9BF", dark: "#425C50" },
    text: { light: "#7A6B55", dark: "#D4C4A0" },
    textMuted: { light: "#8C7A60", dark: "#AAA080" },
  },

  // Dusk/purple tones (for context tags)
  dusk: {
    bg: { light: "#EFECF2", dark: "#36344A" },
    bgSelected: { light: "#847596", dark: "#695C78" },
    border: { light: "#DDD8E5", dark: "#44425A" },
    text: { light: "#695C78", dark: "#C4BBCF" },
  },

  // Mood scale gradient colors (raw hex values for gradient bars)
  moodGradient: [
    "#5B8A5B", // 0 - Elated (sage-500)
    "#7BA87B", // 1 - Very Happy (sage-400)
    "#A8C5A8", // 2 - Good (sage-300)
    "#847596", // 3 - Positive (dusk-500)
    "#A396B3", // 4 - Okay (dusk-400)
    "#BDA77D", // 5 - Neutral (sand-500)
    "#D4A574", // 6 - Low (warm amber)
    "#E08B5A", // 7 - Struggling (soft coral)
    "#E06B55", // 8 - Overwhelmed (coral-500)
    "#C75441", // 9 - Crisis (coral-600)
  ],

  // Swipe action colors
  swipeDelete: {
    bg: { light: "#FDE8E4", dark: "#472E2A" },
    text: { light: "#C75441", dark: "#F5A899" },
  },
  swipeEdit: {
    bg: { light: "#E8EFE8", dark: "#2C4A34" },
    text: { light: "#5B8A5B", dark: "#A8C5A8" },
  },
} as const;

export type ColorKey = keyof typeof colors;
export type ThemeMode = "light" | "dark";

/**
 * Chart-specific color tokens for consistent chart styling.
 */
export const chartColors = {
  // Line/area chart colors
  line: { light: "#5B8A5B", dark: "#A8C5A8" },
  lineSecondary: { light: "#847596", dark: "#C4BBCF" },
  fill: { light: "#7BA87B", dark: "#7BA87B" },
  fillOpacity: 0.14,

  // Grid and axis
  gridLine: { light: "#EDE7DA", dark: "#425C50" },
  axisLabel: { light: "#7A6B55", dark: "#C4AA80" },

  // Background
  chartBg: { light: "#FDFCFA", dark: "#2C3C34" },

  // Dot styling
  dotStroke: "#ffffff",
  dotRadius: 4,

  // Tooltip
  tooltipBg: { light: "#3D352A", dark: "#F5F1E8" },
  tooltipText: { light: "#F5F1E8", dark: "#3D352A" },
} as const;

/**
 * Get chart color based on theme.
 */
export function getChartColor(
  key: keyof typeof chartColors,
  isDark: boolean
): string | number {
  const value = chartColors[key];
  if (typeof value === "object" && value !== null && "light" in value) {
    return isDark ? value.dark : value.light;
  }
  return value;
}

/**
 * Hook to access theme colors based on current color scheme
 */
export function useThemeColors() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  /**
   * Get a simple themed color value for colors that have light/dark variants
   */
  const get = (
    key:
      | "background"
      | "surface"
      | "surfaceAlt"
      | "surfaceElevated"
      | "text"
      | "textMuted"
      | "textSubtle"
      | "textInverse"
      | "primary"
      | "primaryMuted"
      | "primaryBg"
      | "primaryBgHover"
      | "border"
      | "borderSubtle"
  ): string => {
    const color = colors[key];
    return isDark ? color.dark : color.light;
  };

  /**
   * Get category colors for emotions/tags
   */
  const getCategoryColors = (
    category: string | undefined,
    isSelected: boolean = false
  ) => {
    const categoryKey =
      category === "positive" || category === "negative" ? category : "neutral";
    const cat = colors[categoryKey];

    if (isSelected) {
      return {
        bg: isDark ? cat.bgSelected.dark : cat.bgSelected.light,
        text: isDark ? cat.textSelected.dark : cat.textSelected.light,
        border: undefined,
      };
    }

    return {
      bg: isDark ? cat.bg.dark : cat.bg.light,
      text: isDark ? cat.text.dark : cat.text.light,
      border: isDark ? cat.border.dark : cat.border.light,
    };
  };

  /**
   * Get category styles for EmotionListEditor (active/inactive states)
   */
  const getCategoryStyles = () => {
    return {
      positive: {
        active: {
          backgroundColor: isDark
            ? colors.positive.bg.dark
            : colors.positive.bg.light,
          borderColor: isDark
            ? colors.positive.border.dark
            : colors.positive.border.light,
        },
        activeText: isDark
          ? colors.positive.text.dark
          : colors.positive.textDark?.light ?? colors.positive.text.light,
        inactive: {
          backgroundColor: isDark
            ? colors.surfaceAlt.dark
            : colors.surfaceAlt.light,
          borderColor: isDark ? colors.border.dark : colors.border.light,
        },
        inactiveText: isDark ? colors.textMuted.dark : colors.textMuted.light,
      },
      neutral: {
        active: {
          backgroundColor: isDark ? colors.sand.bgHover.dark : colors.sand.bgHover.light,
          borderColor: isDark ? "#4D453A" : colors.sand.border.light,
        },
        activeText: isDark ? colors.sand.text.dark : colors.sand.text.light,
        inactive: {
          backgroundColor: isDark
            ? colors.surfaceAlt.dark
            : colors.surfaceAlt.light,
          borderColor: isDark ? colors.border.dark : colors.border.light,
        },
        inactiveText: isDark ? colors.textMuted.dark : colors.textMuted.light,
      },
      negative: {
        active: {
          backgroundColor: isDark
            ? colors.negative.bg.dark
            : colors.negative.bg.light,
          borderColor: isDark
            ? colors.negative.border.dark
            : "#F5C4BC",
        },
        activeText: isDark
          ? colors.negative.text.dark
          : colors.negative.text.light,
        inactive: {
          backgroundColor: isDark
            ? colors.surfaceAlt.dark
            : colors.surfaceAlt.light,
          borderColor: isDark ? colors.border.dark : colors.border.light,
        },
        inactiveText: isDark ? colors.textMuted.dark : colors.textMuted.light,
      },
    };
  };

  return {
    colors,
    isDark,
    get,
    getCategoryColors,
    getCategoryStyles,
  };
}

/**
 * Static color getter for non-hook contexts
 * @param isDark - Whether dark mode is active
 */
export function getThemedColor(
  key: keyof typeof colors,
  isDark: boolean
): string {
  const color = colors[key];
  if (
    typeof color === "object" &&
    color !== null &&
    "light" in color &&
    "dark" in color
  ) {
    return isDark ? color.dark : color.light;
  }
  return typeof color === "string" ? color : "";
}
