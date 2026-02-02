import React from "react";
import { View, Text, Dimensions } from "react-native";
import { useColorScheme } from "@/hooks/useColorScheme";
import { LineChart } from "react-native-chart-kit";
import {
  format,
  startOfDay,
  addDays,
  isBefore,
  isEqual,
  startOfWeek,
  subDays,
} from "date-fns";
import type { MoodEntry } from "@db/types";
import { moodScale } from "@/constants/moodScale";
import { Ionicons } from "@expo/vector-icons";
import { chartColors, getChartColor } from "@/constants/colors";

/**
 * Daily aggregate data point for charts
 */
export interface DailyDataPoint {
  date: Date;
  moods: number[] | null;
  avg?: number;
  min?: number;
  max?: number;
  finalAvg: number;
  hasRealData: boolean;
  isInterpolated: boolean;
}

/**
 * Weekly aggregate data point for charts
 */
export interface WeeklyDataPoint {
  weekStart: Date;
  moods: number[];
  q1: number;
  q2: number; // median
  q3: number;
  min: number;
  max: number;
  outliers: number[];
  avg: number;
  finalAvg: number;
  isInterpolated: boolean;
}

// Shared Tailwind->hex color map
export const colorMap: Record<string, string> = {
  "text-sky-500": "#03a9f4",
  "text-cyan-500": "#00bcd4",
  "text-teal-500": "#009688",
  "text-emerald-500": "#10b981",
  "text-green-500": "#22c55e",
  "text-gray-500": "#64748b",
  "text-lime-500": "#84cc16",
  "text-yellow-500": "#eab308",
  "text-amber-500": "#f59e0b",
  "text-orange-600": "#ea580c",
  "text-red-500": "#ef4444",
  "text-red-700": "#b91c1c",
};

export const getColorFromTailwind = (cls: string) => colorMap[cls] || "#FFD700";

// Helper function to get mood scale colors for a given mood value
export const getMoodScaleColor = (moodValue: number) => {
  const mood = moodScale.find((m) => m.value === Math.round(moodValue));
  return mood ? mood.color : "text-slate-500";
};

// Helper function to get mood scale background color for a given mood value
export const getMoodScaleBg = (moodValue: number) => {
  const mood = moodScale.find((m) => m.value === Math.round(moodValue));
  return mood ? mood.bg : "bg-slate-100";
};

// Shared chart configuration with proper y-axis range (0-10)
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
    propsForDots: { r: String(chartColors.dotRadius), strokeWidth: "2", stroke: chartColors.dotStroke },
    yAxisMin: 0,
    yAxisMax: 10,
    yAxisInterval: 1,
    propsForBackgroundLines: {
        strokeDasharray: "6, 6",
        stroke: gridColor,
        strokeWidth: 1,
    }
  };
};

// Helper function to get days in range
export const getDaysInRange = (start: Date, end: Date): Date[] => {
  const days: Date[] = [];
  let currentDate = startOfDay(start);
  const finalDate = startOfDay(end);

  while (isBefore(currentDate, finalDate) || isEqual(currentDate, finalDate)) {
    days.push(new Date(currentDate));
    currentDate = addDays(currentDate, 1);
  }
  return days;
};

// Data sampling utility to limit chart data points for performance
// When data exceeds maxPoints, samples evenly to reduce rendering load
export const sampleDataPoints = <T extends { timestamp: number }>(
  data: T[],
  maxPoints: number = 200
): T[] => {
  if (data.length <= maxPoints) {
    return data;
  }

  // Sort by timestamp if not already sorted
  const sorted = [...data].sort(
    (a, b) => a.timestamp - b.timestamp
  );

  // Sample evenly across the dataset
  const step = sorted.length / maxPoints;
  const sampled: T[] = [];
  
  // Always include first and last points
  sampled.push(sorted[0]);
  
  for (let i = 1; i < maxPoints - 1; i++) {
    const index = Math.round(i * step);
    if (index < sorted.length) {
      sampled.push(sorted[index]);
    }
  }
  
  // Always include last point
  if (sorted.length > 1) {
    sampled.push(sorted[sorted.length - 1]);
  }

  return sampled;
};

// Process daily mood data
export const processMoodDataForDailyChart = (
  allMoods: MoodEntry[],
  numDays?: number
) => {
  if (!allMoods || allMoods.length === 0) {
    return { labels: [], dailyAggregates: [] };
  }

  // Limit to last 90 days for performance (or use numDays if provided)
  const maxDays = numDays || 90;
  const sortedMoods = [...allMoods].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  // If we have too many days, limit to recent data
  if (sortedMoods.length === 0) {
    return { labels: [], dailyAggregates: [] };
  }
  
  const mostRecentDate = startOfDay(
    new Date(sortedMoods[sortedMoods.length - 1].timestamp)
  );
  const cutoffDate = startOfDay(subDays(mostRecentDate, maxDays - 1));
  
  const filteredMoods = sortedMoods.filter((mood) => {
    const moodDate = startOfDay(new Date(mood.timestamp));
    return moodDate >= cutoffDate;
  });

  if (filteredMoods.length === 0) {
    return { labels: [], dailyAggregates: [] };
  }

  const latestDate = startOfDay(
    new Date(filteredMoods[filteredMoods.length - 1].timestamp)
  );
  const earliestDate = startOfDay(new Date(filteredMoods[0].timestamp));

  const allDatesInRange = getDaysInRange(earliestDate, latestDate);

  const moodsByDay: Record<string, number[]> = {};
  filteredMoods.forEach((mood) => {
    const dayKey = format(startOfDay(new Date(mood.timestamp)), "yyyy-MM-dd");
    if (!moodsByDay[dayKey]) {
      moodsByDay[dayKey] = [];
    }
    moodsByDay[dayKey].push(mood.mood);
  });

  type DailyMoodAggregateWorking = {
    date: Date;
    moods: number[] | null;
    avg?: number;
    min?: number;
    max?: number;
  };

  const initialAggregates: DailyMoodAggregateWorking[] = allDatesInRange.map(
    (date) => {
      const dateKey = format(date, "yyyy-MM-dd");
      const dayMoods = moodsByDay[dateKey] || null;
      let avg, min, max;

      if (dayMoods && dayMoods.length > 0) {
        avg = dayMoods.reduce((sum, val) => sum + val, 0) / dayMoods.length;
        min = Math.min(...dayMoods);
        max = Math.max(...dayMoods);
        return { date, moods: dayMoods, avg, min, max };
      } else {
        return { date, moods: null };
      }
    }
  );

  const finalAggregates = initialAggregates.map((aggregate, index) => {
    if (aggregate.avg !== undefined) {
      return { ...aggregate, finalAvg: aggregate.avg, hasRealData: true, isInterpolated: false };
    }

    let prevIndex = -1;
    for (let i = index - 1; i >= 0; i--) {
      if (initialAggregates[i].avg !== undefined) {
        prevIndex = i;
        break;
      }
    }

    let nextIndex = -1;
    for (let i = index + 1; i < initialAggregates.length; i++) {
      if (initialAggregates[i].avg !== undefined) {
        nextIndex = i;
        break;
      }
    }

    const prevAgg = prevIndex !== -1 ? initialAggregates[prevIndex] : null;
    const nextAgg = nextIndex !== -1 ? initialAggregates[nextIndex] : null;

    let interpolatedAvg: number;
    if (
      prevAgg &&
      nextAgg &&
      prevAgg.avg !== undefined &&
      nextAgg.avg !== undefined
    ) {
      const x0 = prevAgg.date.getTime();
      const y0 = prevAgg.avg;
      const x1 = nextAgg.date.getTime();
      const y1 = nextAgg.avg;
      const x = aggregate.date.getTime();
      if (x1 === x0) {
        interpolatedAvg = y0;
      } else {
        interpolatedAvg = y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      }
    } else if (prevAgg && prevAgg.avg !== undefined) {
      interpolatedAvg = prevAgg.avg;
    } else if (nextAgg && nextAgg.avg !== undefined) {
      interpolatedAvg = nextAgg.avg;
    } else {
      const neutralMood = moodScale.find((s) => s.label === "Neutral");
      interpolatedAvg = neutralMood ? neutralMood.value : 5;
    }
    return { ...aggregate, finalAvg: interpolatedAvg, hasRealData: false, isInterpolated: true };
  });

  const labels = finalAggregates.map((agg) => format(agg.date, "d"));

  return { labels, dailyAggregates: finalAggregates };
};

// Process weekly mood data
export const processWeeklyMoodData = (allMoods: MoodEntry[], maxWeeks: number = 52) => {
  if (!allMoods || allMoods.length === 0) {
    return { labels: [], weeklyAggregates: [] };
  }

  const sortedMoods = [...allMoods].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  // Limit to recent weeks for performance
  const cutoffDate = subDays(new Date(), maxWeeks * 7);
  const filteredMoods = sortedMoods.filter(
    (mood) => new Date(mood.timestamp) >= cutoffDate
  );

  const moodsByWeek: Record<string, number[]> = {};
  filteredMoods.forEach((mood) => {
    const date = new Date(mood.timestamp);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // 1 = Monday
    const weekKey = format(weekStart, "yyyy-MM-dd");
    if (!moodsByWeek[weekKey]) {
      moodsByWeek[weekKey] = [];
    }
    moodsByWeek[weekKey].push(mood.mood);
  });

  const getQuartiles = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const q1Idx = Math.floor(sorted.length * 0.25);
    const q2Idx = Math.floor(sorted.length * 0.5);
    const q3Idx = Math.floor(sorted.length * 0.75);
    return {
      q1: sorted[q1Idx],
      q2: sorted[q2Idx], // median
      q3: sorted[q3Idx],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      outliers: sorted.filter(
        (v) =>
          v < sorted[q1Idx] - 1.5 * (sorted[q3Idx] - sorted[q1Idx]) ||
          v > sorted[q3Idx] + 1.5 * (sorted[q3Idx] - sorted[q1Idx])
      ),
    };
  };

  const weekKeys = Object.keys(moodsByWeek).sort().reverse();
  const weeklyAggregates = weekKeys.map((weekKey) => {
    const weekMoods = moodsByWeek[weekKey];
    const stats = getQuartiles(weekMoods);
    const avg = weekMoods.reduce((sum, val) => sum + val, 0) / weekMoods.length;

    return {
      weekStart: new Date(weekKey),
      moods: weekMoods,
      ...stats,
      avg,
      finalAvg: stats.q2, // use median instead of mean
      isInterpolated: false,
    };
  });

  return {
    labels: weeklyAggregates.map((week) => format(week.weekStart, "'W'w MMM")),
    weeklyAggregates,
  };
};

// Mini Weekly Chart Component for Overview (memoized for performance)
export const MiniWeeklyChart = React.memo(({ weeklyData, reduceMotion = false }: { weeklyData: WeeklyDataPoint[]; reduceMotion?: boolean }) => {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  if (!weeklyData.length) {
    return null;
  }

  // Calculate chart data
  const weeklyAverages = weeklyData.map((week) => week.avg);
  const minValue = Math.min(...weeklyAverages);
  const maxValue = Math.max(...weeklyAverages);

  // Generate accessibility summary
  const avgOfAverages = weeklyAverages.reduce((sum, val) => sum + val, 0) / weeklyAverages.length;
  const accessibilityLabel = `Weekly mood overview chart showing ${weeklyData.length} weeks of data. Average mood: ${avgOfAverages.toFixed(1)} out of 10.`;

  // Add some padding to the y-axis range
  const padding = (maxValue - minValue) * 0.1 || 0.5; // 10% padding or 0.5 minimum
  const yMin = Math.max(0, Math.floor(minValue - padding)); // Don't go below 0
  const yMax = Math.min(10, Math.ceil(maxValue + padding)); // Don't go above 10

  // Calculate appropriate interval based on range
  const range = yMax - yMin;
  let yInterval = 1;
  if (range <= 2) yInterval = 0.5;
  else if (range <= 4) yInterval = 1;
  else if (range <= 8) yInterval = 2;
  else yInterval = 2;

  // Get chart colors from tokens
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
      {
        data: [yMin], // Dynamic min value for y-axis
        withDots: false,
      },
      {
        data: [yMax], // Dynamic max value for y-axis
        withDots: false,
      },
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
    propsForDots: { r: String(chartColors.dotRadius), strokeWidth: "2", stroke: chartColors.dotStroke },
    yAxisMin: yMin,
    yAxisMax: yMax,
    yAxisInterval: yInterval,
    propsForBackgroundLines: {
        strokeDasharray: "6, 6",
        stroke: gridColor,
        strokeWidth: 1,
    }
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
        width={Dimensions.get("window").width - 64}
        height={200}
        chartConfig={chartConfig}
        style={{ borderRadius: 16 }}
        bezier={!reduceMotion}
        segments={5}
      />
    </View>
  );
});

// Mood interpretation helper that uses actual mood scale colors and labels
export const getMoodInterpretation = (average: number) => {
  const roundedAverage = Math.round(average);
  const moodInfo = moodScale.find((m) => m.value === roundedAverage);

  if (moodInfo) {
    return {
      color: moodInfo.color.replace("text-", ""),
      text: moodInfo.label,
      bg: moodInfo.bg,
      textClass: moodInfo.color,
      bgClass: moodInfo.bg,
    };
  }

  // Fallback for values not in mood scale
  if (average <= 2)
    return {
      color: "sky-500",
      text: "Excellent",
      bg: "bg-sky-100",
      textClass: "text-sky-500",
      bgClass: "bg-sky-100",
    };
  if (average <= 4)
    return {
      color: "green-500",
      text: "Good",
      bg: "bg-green-100",
      textClass: "text-green-500",
      bgClass: "bg-green-100",
    };
  if (average <= 6)
    return {
      color: "yellow-500",
      text: "Fair",
      bg: "bg-yellow-100",
      textClass: "text-yellow-500",
      bgClass: "bg-yellow-100",
    };
  if (average <= 8)
    return {
      color: "orange-600",
      text: "Challenging",
      bg: "bg-orange-100",
      textClass: "text-orange-600",
      bgClass: "bg-orange-100",
    };
  return {
    color: "red-500",
    text: "Difficult",
    bg: "bg-red-100",
    textClass: "text-red-500",
    bgClass: "bg-red-100",
  };
};

// Trend interpretation helper (remember: lower number = improvement)
export const getTrendInterpretation = (trend: number) => {
  if (trend < -0.5)
    return {
      color: "green",
      text: "Trending Better",
      emoji: "🎉",
      textClass: "text-emerald-600",
      bgClass: "bg-emerald-100 dark:bg-emerald-900/30",
    };
  if (trend < 0)
    return {
      color: "blue",
      text: "Improving",
      emoji: "📈",
      textClass: "text-blue-600",
      bgClass: "bg-blue-100 dark:bg-blue-900/30",
    };
  if (trend > 0.5)
    return {
      color: "red",
      text: "Declining",
      emoji: "📉",
      textClass: "text-red-600",
      bgClass: "bg-red-100 dark:bg-red-900/30",
    };
  if (trend > 0)
    return {
      color: "orange",
      text: "Slight Dip",
      emoji: "📊",
      textClass: "text-amber-600",
      bgClass: "bg-amber-100 dark:bg-amber-900/30",
    };
  return {
    color: "gray",
    text: "Steady",
    emoji: "➡️",
    textClass: "text-slate-600",
    bgClass: "bg-slate-100 dark:bg-slate-800",
  };
};
