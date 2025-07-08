import React from "react";
import { View, Text, ScrollView, Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Circle, Line } from "react-native-svg";
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

// Shared Tailwind->hex color map
export const colorMap: Record<string, string> = {
  "text-sky-500": "#03a9f4",
  "text-cyan-500": "#00bcd4",
  "text-teal-500": "#009688",
  "text-emerald-500": "#4caf50",
  "text-green-500": "#4caf50",
  "text-gray-500": "#9e9e9e",
  "text-lime-500": "#cddc39",
  "text-yellow-500": "#ffeb3b",
  "text-amber-500": "#ffc107",
  "text-orange-600": "#fb8c00",
  "text-red-500": "#f44336",
  "text-red-700": "#d32f2f",
};

export const getColorFromTailwind = (cls: string) => colorMap[cls] || "#FFD700";

// Helper function to get mood scale colors for a given mood value
export const getMoodScaleColor = (moodValue: number) => {
  const mood = moodScale.find((m) => m.value === Math.round(moodValue));
  return mood ? mood.color : "text-gray-500";
};

// Helper function to get mood scale background color for a given mood value
export const getMoodScaleBg = (moodValue: number) => {
  const mood = moodScale.find((m) => m.value === Math.round(moodValue));
  return mood ? mood.bg : "bg-gray-100";
};

// Shared chart configuration with proper y-axis range (0-10)
export const getBaseChartConfig = (
  gradientFrom: string,
  gradientTo: string
) => ({
  backgroundColor: "#ffffff",
  backgroundGradientFrom: gradientFrom,
  backgroundGradientTo: gradientTo,
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: { r: "6", strokeWidth: "2" },
  yAxisMin: 0,
  yAxisMax: 10,
  yAxisInterval: 1,
});

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

// Process daily mood data
export const processMoodDataForDailyChart = (
  allMoods: MoodEntry[],
  numDays: number
) => {
  if (!allMoods || allMoods.length === 0) {
    return { labels: [], dailyAggregates: [] };
  }

  const sortedMoods = [...allMoods].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const latestDate = startOfDay(
    new Date(sortedMoods[sortedMoods.length - 1].timestamp)
  );
  const earliestDate = startOfDay(subDays(latestDate, numDays - 1));

  const filteredMoods = sortedMoods.filter((mood) => {
    const moodDate = startOfDay(new Date(mood.timestamp));
    return moodDate >= earliestDate && moodDate <= latestDate;
  });

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
      return { ...aggregate, finalAvg: aggregate.avg, isInterpolated: false };
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
    return { ...aggregate, finalAvg: interpolatedAvg, isInterpolated: true };
  });

  const labels = finalAggregates.map((agg) => format(agg.date, "d"));

  return { labels, dailyAggregates: finalAggregates };
};

// Process weekly mood data
export const processWeeklyMoodData = (allMoods: MoodEntry[]) => {
  if (!allMoods || allMoods.length === 0) {
    return { labels: [], weeklyAggregates: [] };
  }

  const sortedMoods = [...allMoods].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const moodsByWeek: Record<string, number[]> = {};
  sortedMoods.forEach((mood) => {
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

// Mini Weekly Chart Component for Overview
export const MiniWeeklyChart = ({ weeklyData }: { weeklyData: any[] }) => {
  if (!weeklyData.length) return null;

  const weeklyAverages = weeklyData.map((week) => week.avg);
  const minValue = Math.min(...weeklyAverages);
  const maxValue = Math.max(...weeklyAverages);

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

  // Custom chart config with visible labels and dynamic y-axis
  const chartConfig = {
    backgroundColor: "#ffffff",
    backgroundGradientFrom: "#f8fafc",
    backgroundGradientTo: "#e2e8f0",
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`, // Dark gray for visibility
    style: { borderRadius: 16 },
    propsForDots: { r: "6", strokeWidth: "2" },
    yAxisMin: yMin,
    yAxisMax: yMax,
    yAxisInterval: yInterval,
  };

  return (
    <View className="mx-4 mb-6 bg-white p-4 rounded-2xl shadow-lg">
      <Text className="text-lg font-semibold text-center mb-3 text-gray-800">
        📅 Last 4 Weeks Trend
      </Text>
      <LineChart
        data={chartData}
        width={Dimensions.get("window").width - 64}
        height={200}
        chartConfig={chartConfig}
        style={{ borderRadius: 16 }}
        bezier
        segments={10}
      />
    </View>
  );
};

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
      text: "Great improvement!",
      emoji: "🎉",
      textClass: "text-cyan-500",
      bgClass: "bg-cyan-50",
    };
  if (trend < 0)
    return {
      color: "blue",
      text: "Slight improvement",
      emoji: "📈",
      textClass: "text-green-500",
      bgClass: "bg-green-50",
    };
  if (trend > 0.5)
    return {
      color: "red",
      text: "Needs attention",
      emoji: "💙",
      textClass: "text-red-500",
      bgClass: "bg-red-50",
    };
  if (trend > 0)
    return {
      color: "orange",
      text: "Slight decline",
      emoji: "📊",
      textClass: "text-orange-500",
      bgClass: "bg-orange-50",
    };
  return {
    color: "gray",
    text: "Steady as she goes",
    emoji: "📊",
    textClass: "text-gray-400",
    bgClass: "bg-gray-50",
  };
};
