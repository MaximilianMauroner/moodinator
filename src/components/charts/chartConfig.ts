/**
 * Chart library configuration
 *
 * Builds react-native-chart-kit config objects. Kept separate from data
 * processing (moodChartData) and from component rendering (ChartComponents)
 * because it is the only layer that needs to know about the chart library's
 * config shape.
 */

import { chartColors, getChartColor } from "@/constants/colors";

/** Returns a base chart config for react-native-chart-kit with a fixed 0–10
 *  y-axis range, theme-aware background/grid colours, and consistent dot/line
 *  styling. gradientFrom sets the fill-shadow colour. */
export const getBaseChartConfig = (
  gradientFrom: string,
  _gradientTo: string,
  isDark?: boolean
) => {
  const bgColor = getChartColor("chartBg", !!isDark) as string;
  const gridColor = getChartColor("gridLine", !!isDark) as string;

  return {
    backgroundColor: bgColor,
    backgroundGradientFrom: bgColor,
    backgroundGradientTo: bgColor,
    fillShadowGradient: gradientFrom,
    fillShadowGradientOpacity: chartColors.fillOpacity,
    decimalPlaces: 1,
    color: (opacity = 1) =>
      isDark
        ? `rgba(255, 255, 255, ${opacity})`
        : `rgba(59, 130, 246, ${opacity})`,
    labelColor: (opacity = 1) =>
      isDark
        ? `rgba(148, 163, 184, ${opacity})`
        : `rgba(100, 116, 139, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: {
      r: String(chartColors.dotRadius),
      strokeWidth: "2",
      stroke: chartColors.dotStroke,
    },
    yAxisMin: 0,
    yAxisMax: 10,
    yAxisInterval: 1,
    propsForBackgroundLines: {
      strokeDasharray: "6, 6",
      stroke: gridColor,
      strokeWidth: 1,
    },
  };
};
