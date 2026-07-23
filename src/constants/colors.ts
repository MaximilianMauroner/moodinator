/**
 * Centralized theme colors for the Moodinator app
 * Soft Organic palette - warm, natural, cozy tones
 */

import { useColorScheme } from "@/hooks/useColorScheme";

export const colors = {
  // Background colors
  background: { light: "#FAF8F4", dark: "#08150F" },
  surface: { light: "#FDFCFA", dark: "#14251C" },
  surfaceAlt: { light: "#F5F1E8", dark: "#111F17" },
  surfaceElevated: { light: "#F9F5ED", dark: "#182C20" },

  // Text colors
  text: { light: "#3D352A", dark: "#F0F7EA" },
  textMuted: { light: "#5C4E3D", dark: "#C7D8BC" },
  textSubtle: { light: "#7A6B55", dark: "#9EB894" },
  textInverse: { light: "#FDFCFA", dark: "#FDFCFA" },

  // Primary accent (sage green)
  primary: { light: "#5B8A5B", dark: "#A6E39B" },
  onPrimary: { light: "#08150F", dark: "#08150F" },
  primaryMuted: { light: "#7BA87B", dark: "#C8F5BE" },
  primaryBg: { light: "#E8EFE8", dark: "#122A1A" },
  primaryBgHover: { light: "#D1DFD1", dark: "#193622" },

  // Border colors
  border: { light: "#E5D9BF", dark: "#2F513B" },
  borderSubtle: { light: "#F2EBD9", dark: "#233D2D" },

  // Overlay
  overlay: "rgba(0,0,0,0.4)",

  // Category colors - for emotions and tags
  positive: {
    bg: { light: "#E8EFE8", dark: "#122A1A" },
    bgSelected: { light: "#476D47", dark: "#34703D" },
    border: { light: "#D1DFD1", dark: "#2F5A39" },
    text: { light: "#476D47", dark: "#C8F5BE" },
    textSelected: { light: "#FDFCFA", dark: "#FDFCFA" },
    textDark: { light: "#476D47", dark: "#C8F5BE" },
  },
  negative: {
    bg: { light: "#FDE8E4", dark: "#482721" },
    bgSelected: { light: "#A53F30", dark: "#D87561" },
    border: { light: "#FACFC7", dark: "#693930" },
    text: { light: "#A53F30", dark: "#F2B4A6" },
    textSelected: { light: "#FDFCFA", dark: "#08150F" },
  },
  neutral: {
    bg: { light: "#EFECF2", dark: "#332D3D" },
    bgSelected: { light: "#695C78", dark: "#8A7AA0" },
    border: { light: "#DDD8E5", dark: "#51485F" },
    text: { light: "#695C78", dark: "#D5CCDD" },
    textSelected: { light: "#FDFCFA", dark: "#08150F" },
  },

  // Sand/warm tones (for energy, timestamps, etc.)
  sand: {
    bg: { light: "#F9F5ED", dark: "#3D321F" },
    bgSelected: { light: "#9D8660", dark: "#C3A66F" },
    bgHover: { light: "#FDF8EF", dark: "#252D22" },
    border: { light: "#E5D9BF", dark: "#5B5036" },
    text: { light: "#7A6B55", dark: "#E0C993" },
    textMuted: { light: "#8C7A60", dark: "#BDAE8A" },
  },

  // Dusk/purple tones (for context tags)
  dusk: {
    bg: { light: "#EFECF2", dark: "#332D3D" },
    bgSelected: { light: "#847596", dark: "#8A7AA0" },
    border: { light: "#DDD8E5", dark: "#51485F" },
    text: { light: "#695C78", dark: "#D5CCDD" },
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
    "#9D3D30", // 10 - Emergency (coral-700)
  ],

  /**
   * Energy card (0 drained → 10 wired): higher is better.
   * Ramp reads depleted → neutral → vitality (coral/rose → sand → sage), not cool→hot.
   */
  energySegmentColors: {
    light: [
      "#C49A92", // 0 — depleted (muted coral)
      "#C6A08E",
      "#C8A68C",
      "#C8AC84",
      "#C6AE7C",
      "#BDA77D", // 5 — sand / moderate
      "#B0B892",
      "#9BB88A",
      "#85B082",
      "#6FA46E",
      "#5B8A5B", // 10 — wired (sage-500)
    ],
    dark: [
      "#5B3932", // 0 — depleted
      "#604036",
      "#65483A",
      "#65503E",
      "#65583F",
      "#756242", // 5 — sand-brown mid
      "#69734E",
      "#5D7D4F",
      "#558754",
      "#55935D",
      "#A6E39B", // 10 — bright sage
    ],
  },

  // Swipe action colors
  swipeDelete: {
    bg: { light: "#FDE8E4", dark: "#482721" },
    text: { light: "#C75441", dark: "#F2B4A6" },
  },
  swipeEdit: {
    bg: { light: "#E8EFE8", dark: "#122A1A" },
    text: { light: "#5B8A5B", dark: "#C8F5BE" },
  },
} as const;

export type ColorKey = keyof typeof colors;
export type ThemeMode = "light" | "dark";

/**
 * Chart-specific color tokens for consistent chart styling.
 */
export const chartColors = {
  // Line/area chart colors
  line: { light: "#5B8A5B", dark: "#A6E39B" },
  lineSecondary: { light: "#847596", dark: "#D5CCDD" },
  fill: { light: "#7BA87B", dark: "#A6E39B" },
  fillOpacity: 0.14,

  // Grid and axis
  gridLine: { light: "#EDE7DA", dark: "#47414C" },
  axisLabel: { light: "#7A6B55", dark: "#C7B895" },

  // Background
  chartBg: { light: "#FDFCFA", dark: "#14251C" },

  // Dot styling
  dotStroke: "#ffffff",
  dotRadius: 4,

  // Tooltip
  tooltipBg: { light: "#3D352A", dark: "#F5F1E8" },
  tooltipText: { light: "#F5F1E8", dark: "#3D352A" },
} as const;

export const semanticToneColors = {
  sage: {
    light: { bg: "#E8EFE8", fg: "#476D47", ring: "rgba(91, 138, 91, 0.16)", border: "#D1DFD1" },
    dark: { bg: "#122A1A", fg: "#C8F5BE", ring: "rgba(200, 245, 190, 0.12)", border: "#2F5A39" },
  },
  sand: {
    light: { bg: "#F9F5ED", fg: "#7A6545", ring: "rgba(157, 134, 96, 0.14)", border: "#E9DCC1" },
    dark: { bg: "#3D321F", fg: "#E0C993", ring: "rgba(224, 201, 147, 0.14)", border: "#5B5036" },
  },
  coral: {
    light: { bg: "#FDE8E4", fg: "#A53F30", ring: "rgba(224, 107, 85, 0.16)", border: "#FACFC7" },
    dark: { bg: "#4B2A22", fg: "#F2B4A6", ring: "rgba(242, 180, 166, 0.16)", border: "#6B3B31" },
  },
  dusk: {
    light: { bg: "#EFECF2", fg: "#695C78", ring: "rgba(132, 117, 150, 0.16)", border: "#DDD8E5" },
    dark: { bg: "#332D3D", fg: "#D5CCDD", ring: "rgba(213, 204, 221, 0.16)", border: "#51485F" },
  },
  neutral: {
    light: { bg: "#F5F1E8", fg: "#6B5C4A", ring: "rgba(157, 134, 96, 0.14)", border: "#E5D9BF" },
    dark: { bg: "#111F17", fg: "#C7D8BC", ring: "rgba(199, 216, 188, 0.10)", border: "#2F513B" },
  },
} as const;

export const effectColors = {
  shadow: {
    light: "#9D8660",
    dark: "#09130E",
    black: "#000",
  },
  overlay: {
    scrim: "rgba(0,0,0,0.4)",
    lightGlass: "rgba(255,255,255,0.7)",
    darkGlass: "rgba(0,0,0,0.2)",
  },
} as const;

export type SemanticTone = keyof typeof semanticToneColors;

/** Fill color for energy UI (slider segment, detail bar) for index 0–10 */
export function getEnergySegmentColor(level: number, isDark: boolean): string {
  const i = Math.max(0, Math.min(10, Math.round(level)));
  const stops = isDark
    ? colors.energySegmentColors.dark
    : colors.energySegmentColors.light;
  return stops[i] ?? stops[stops.length - 1];
}

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
      | "onPrimary"
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
    "dark" in color &&
    typeof color.light === "string" &&
    typeof color.dark === "string"
  ) {
    return isDark ? color.dark : color.light;
  }
  return typeof color === "string" ? color : "";
}
