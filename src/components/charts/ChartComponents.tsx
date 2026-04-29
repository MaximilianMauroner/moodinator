import React from "react";
import { View, Text, useWindowDimensions } from "react-native";
import { useColorScheme } from "@/hooks/useColorScheme";
import { LineChart } from "react-native-chart-kit";
import { format } from "date-fns";
import { Ionicons } from "@expo/vector-icons";
import { chartColors, getChartColor } from "@/constants/colors";
import type { WeeklyDataPoint } from "@/lib/moodChartData";
import { getBaseChartConfig } from "./chartConfig";

// Mini Weekly Chart Component for Overview (memoized for performance)
export const MiniWeeklyChart = React.memo(
  ({
    weeklyData,
    reduceMotion = false,
  }: {
    weeklyData: WeeklyDataPoint[];
    reduceMotion?: boolean;
  }) => {
    const scheme = useColorScheme();
    const isDark = scheme === "dark";
    const { width: windowWidth } = useWindowDimensions();

    if (!weeklyData.length) {
      return null;
    }

    const weeklyAverages = weeklyData.map((week) => week.avg);
    const minValue = Math.min(...weeklyAverages);
    const maxValue = Math.max(...weeklyAverages);

    const avgOfAverages =
      weeklyAverages.reduce((sum, val) => sum + val, 0) / weeklyAverages.length;
    const accessibilityLabel = `Weekly mood overview chart showing ${weeklyData.length} weeks of data. Average mood: ${avgOfAverages.toFixed(1)} out of 10.`;

    const padding = (maxValue - minValue) * 0.1 || 0.5;
    const yMin = Math.max(0, Math.floor(minValue - padding));
    const yMax = Math.min(10, Math.ceil(maxValue + padding));

    const range = yMax - yMin;
    let yInterval = 1;
    if (range <= 2) yInterval = 0.5;
    else if (range <= 4) yInterval = 1;
    else if (range <= 8) yInterval = 2;
    else yInterval = 2;

    const bgColor = getChartColor("chartBg", isDark) as string;
    const lineColor = getChartColor("line", isDark) as string;
    const gridColor = getChartColor("gridLine", isDark) as string;

    const chartData = {
      labels: weeklyData.map((week) => format(week.weekStart, "MMM dd")),
      datasets: [
        {
          data: weeklyAverages,
          strokeWidth: 3,
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
        },
        { data: [yMin], withDots: false },
        { data: [yMax], withDots: false },
      ],
    };

    const chartConfig = {
      backgroundColor: bgColor,
      backgroundGradientFrom: bgColor,
      backgroundGradientTo: bgColor,
      fillShadowGradient: lineColor,
      fillShadowGradientOpacity: chartColors.fillOpacity,
      decimalPlaces: 1,
      color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
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
      yAxisMin: yMin,
      yAxisMax: yMax,
      yAxisInterval: yInterval,
      propsForBackgroundLines: {
        strokeDasharray: "6, 6",
        stroke: gridColor,
        strokeWidth: 1,
      },
    };

    return (
      <View
        className="mx-4 mb-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm overflow-hidden"
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      >
        <View className="flex-row justify-between items-center mb-4 px-2">
          <Text className="text-lg font-bold text-slate-800 dark:text-slate-200">
            Overview
          </Text>
          <View className="bg-blue-50 dark:bg-blue-900/20 p-1.5 rounded-lg">
            <Ionicons name="bar-chart-outline" size={16} color="#3b82f6" />
          </View>
        </View>
        <LineChart
          data={chartData}
          width={windowWidth - 64}
          height={200}
          chartConfig={chartConfig}
          style={{ borderRadius: 16 }}
          bezier={!reduceMotion}
          segments={5}
        />
      </View>
    );
  }
);

MiniWeeklyChart.displayName = "MiniWeeklyChart";
