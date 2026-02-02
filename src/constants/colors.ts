/**
 * Centralized theme colors for the Moodinator app
 * Soft Organic palette - warm, natural, cozy tones
 */

import { useColorScheme } from "@/hooks/useColorScheme";

export const colors = {
  // Background colors
  background: { light: "#FAF8F4", dark: "#1C1916" },
  surface: { light: "#FDFCFA", dark: "#231F1B" },
  surfaceAlt: { light: "#F5F1E8", dark: "#2A2520" },
  surfaceElevated: { light: "#F9F5ED", dark: "#302A22" },

  // Text colors
  text: { light: "#3D352A", dark: "#F5F1E8" },
  textMuted: { light: "#6B5C4A", dark: "#BDA77D" },
  textSubtle: { light: "#9D8660", dark: "#D4C4A0" },
  textInverse: { light: "#FFFFFF", dark: "#FFFFFF" },

  // Primary accent (sage green)
  primary: { light: "#5B8A5B", dark: "#5B8A5B" },
  primaryMuted: { light: "#7BA87B", dark: "#7BA87B" },
  primaryBg: { light: "#E8EFE8", dark: "#2D3D2D" },
  primaryBgHover: { light: "#D1DFD1", dark: "#3D4D3D" },

  // Border colors
  border: { light: "#E5D9BF", dark: "#3D352A" },
  borderSubtle: { light: "#F2EBD9", dark: "#2A2520" },

  // Overlay
  overlay: "rgba(0,0,0,0.4)",

  // Category colors - for emotions and tags
  positive: {
    bg: { light: "#E8EFE8", dark: "#2D3D2D" },
    bgSelected: { light: "#5B8A5B", dark: "#5B8A5B" },
    border: { light: "#D1DFD1", dark: "#3D4D3D" },
    text: { light: "#5B8A5B", dark: "#A8C5A8" },
    textSelected: { light: "#FFFFFF", dark: "#FFFFFF" },
    textDark: { light: "#476D47", dark: "#A8C5A8" },
  },
  negative: {
    bg: { light: "#FDE8E4", dark: "#3D2822" },
    bgSelected: { light: "#E06B55", dark: "#C75441" },
    border: { light: "#FACFC7", dark: "#4D3832" },
    text: { light: "#C75441", dark: "#F5A899" },
    textSelected: { light: "#FFFFFF", dark: "#FFFFFF" },
  },
  neutral: {
    bg: { light: "#EFECF2", dark: "#2D2A33" },
    bgSelected: { light: "#847596", dark: "#695C78" },
    border: { light: "#DDD8E5", dark: "#3D3A43" },
    text: { light: "#695C78", dark: "#C4BBCF" },
    textSelected: { light: "#FFFFFF", dark: "#FFFFFF" },
  },

  // Sand/warm tones (for energy, timestamps, etc.)
  sand: {
    bg: { light: "#F9F5ED", dark: "#302A22" },
    bgSelected: { light: "#9D8660", dark: "#BDA77D" },
    bgHover: { light: "#FDF8EF", dark: "#3D352A" },
    border: { light: "#E5D9BF", dark: "#3D352A" },
    text: { light: "#9D8660", dark: "#D4C4A0" },
    textMuted: { light: "#BDA77D", dark: "#6B5C4A" },
  },

  // Dusk/purple tones (for context tags)
  dusk: {
    bg: { light: "#EFECF2", dark: "#2D2A33" },
    bgSelected: { light: "#847596", dark: "#695C78" },
    border: { light: "#DDD8E5", dark: "#3D3A43" },
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
    bg: { light: "#FDE8E4", dark: "#3D2822" },
    text: { light: "#C75441", dark: "#F5A899" },
  },
  swipeEdit: {
    bg: { light: "#E8EFE8", dark: "#2D3D2D" },
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
  line: { light: "#3b82f6", dark: "#60a5fa" },
  lineSecondary: { light: "#8b5cf6", dark: "#a78bfa" },
  fill: { light: "#3b82f6", dark: "#60a5fa" },
  fillOpacity: 0.1,

  // Grid and axis
  gridLine: { light: "#e2e8f0", dark: "#1e293b" },
  axisLabel: { light: "#64748b", dark: "#94a3b8" },

  // Background
  chartBg: { light: "#ffffff", dark: "#0f172a" },

  // Dot styling
  dotStroke: "#ffffff",
  dotRadius: 4,

  // Tooltip
  tooltipBg: { light: "#1e293b", dark: "#f8fafc" },
  tooltipText: { light: "#f8fafc", dark: "#1e293b" },
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
