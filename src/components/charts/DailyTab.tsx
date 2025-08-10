import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import {
  format,
  startOfDay,
  endOfDay,
  isWithinInterval,
  subDays,
} from "date-fns";
import type { MoodEntry } from "@db/types";
import { Circle, Line } from "react-native-svg";
import {
  processMoodDataForDailyChart,
  getBaseChartConfig,
  getColorFromTailwind,
  getMoodInterpretation,
} from "./ChartComponents";
import { moodScale } from "@/constants/moodScale";
import type { MoodScale } from "@/types/mood";
import { useColorScheme } from "@/hooks/useColorScheme";

// Memoized component for individual day items to prevent unnecessary re-renders
const DayItem = React.memo(
  ({
    day,
    dayMoodEntries,
    isExpanded,
    onToggle,
  }: {
    day: any;
    dayMoodEntries: MoodEntry[];
    isExpanded: boolean;
    onToggle: () => void;
  }) => {
    const interpretation = getMoodInterpretation(day.finalAvg);
    const hasRealData = day.hasRealData;

    return (
      <View className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl mb-3 shadow-sm">
        <TouchableOpacity
          onPress={onToggle}
          className="flex-row justify-between items-center"
          activeOpacity={0.7}
        >
          <View className="flex-1">
            <Text className="font-semibold text-gray-800 dark:text-slate-200">
              {format(day.date, "EEEE, MMM dd")}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-slate-400">
              {hasRealData
                ? `${day.moods!.length} entries • Range: ${day.min}-${day.max}`
                : "No entries for this day"}
            </Text>
            {hasRealData && day.moods!.length > 1 && (
              <Text className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                Individual moods: {day.moods!.join(", ")}
              </Text>
            )}
          </View>
          <View className="items-end">
            <Text className={`text-2xl font-bold ${interpretation.textClass}`}>
              {day.finalAvg.toFixed(1)}
            </Text>
            <View
              className={`px-2 py-1 rounded mt-1 ${interpretation.bgClass}`}
            >
              <Text
                className={`text-xs font-medium ${interpretation.textClass
                  .replace("500", "700")
                  .replace("600", "700")}`}
              >
                {interpretation.text}
              </Text>
            </View>
            {!hasRealData && (
              <Text className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                (no data)
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Accordion Content - Mood Entries */}
        {isExpanded && (
          <View className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
            <Text className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-3">
              📝 Mood Entries for this Day:
            </Text>
            {dayMoodEntries.length > 0 ? (
              <View className="space-y-2">
                {dayMoodEntries.map((entry) => {
                  const entryMoodInfo = moodScale.find(
                    (m: MoodScale) => m.value === entry.mood
                  );
                  return (
                    <View
                      key={entry.id}
                      className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg mb-2"
                    >
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1">
                          <View className="flex flex-row justify-between items-center">
                            <View className="flex flex-row items-center space-x-1">
                              <Text
                                className={`text-lg font-bold ${
                                  entryMoodInfo?.color || "text-gray-600"
                                }`}
                              >
                                {entry.mood}
                              </Text>
                              <View
                                className={`px-2 py-1 rounded-full ml-2 ${
                                  entryMoodInfo?.bg || "bg-gray-200"
                                }`}
                              >
                                <Text
                                  className={`text-xs font-medium ${
                                    entryMoodInfo?.color || "text-gray-600"
                                  }`}
                                >
                                  {entryMoodInfo?.label || `Mood ${entry.mood}`}
                                </Text>
                              </View>
                            </View>
                            <View>
                              {entry.note && (
                                <Text className="text-sm text-gray-600 dark:text-slate-300 italic">
                                  "{entry.note}"
                                </Text>
                              )}
                              <Text className="text-xs text-gray-500 dark:text-slate-400">
                                {format(new Date(entry.timestamp), "HH:mm")}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text className="text-sm text-gray-500 dark:text-slate-400 italic">
                No detailed entries available for this day.
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }
);
DayItem.displayName = "DayItem";

export const DailyTab = ({
  moods,
  onRefresh,
}: {
  moods: MoodEntry[];
  onRefresh: () => void;
}) => {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const processedData = useMemo(() => {
    return processMoodDataForDailyChart(moods);
  }, [moods]);

  const { dailyAggregates, labels } = processedData;

  const reversedAggregates = useMemo(
    () => [...dailyAggregates].reverse(),
    [dailyAggregates]
  );

  // Limit to last 7 days for Recent Days section
  const recentDaysAggregates = useMemo(
    () => reversedAggregates.slice(0, 7),
    [reversedAggregates]
  );

  const moodEntriesByDay = useMemo(() => {
    const map = new Map<string, MoodEntry[]>();
    moods.forEach((mood) => {
      const dayKey = startOfDay(new Date(mood.timestamp)).toString();
      if (!map.has(dayKey)) {
        map.set(dayKey, []);
      }
      map.get(dayKey)!.push(mood);
    });
    return map;
  }, [moods]);

  const dailyStats = useMemo(() => {
    if (!dailyAggregates || dailyAggregates.length === 0) {
      return {
        bestDay: 0,
        worstDay: 0,
        averageDay: 0,
        daysWithEntries: 0,
        totalDays: 0,
      };
    }

    const daysWithData = dailyAggregates.filter((d) => !d.isInterpolated);
    if (daysWithData.length === 0) {
      return {
        bestDay: 0,
        worstDay: 0,
        averageDay: 0,
        daysWithEntries: 0,
        totalDays: dailyAggregates.length,
      };
    }

    const bestDay = Math.min(...daysWithData.map((d) => d.finalAvg));
    const worstDay = Math.max(...daysWithData.map((d) => d.finalAvg));
    const averageDay =
      daysWithData.reduce((sum, d) => sum + d.finalAvg, 0) /
      daysWithData.length;

    return {
      bestDay,
      worstDay,
      averageDay,
      daysWithEntries: daysWithData.length,
      totalDays: dailyAggregates.length,
    };
  }, [dailyAggregates]);

  const toggleDayExpansion = useCallback((dayKey: string) => {
    setExpandedDays((prev) => {
      const newExpandedDays = new Set(prev);
      if (newExpandedDays.has(dayKey)) {
        newExpandedDays.delete(dayKey);
      } else {
        newExpandedDays.add(dayKey);
      }
      return newExpandedDays;
    });
  }, []);

  const toggleCallbacks = useMemo(() => {
    const callbacks: { [key: string]: () => void } = {};
    dailyAggregates.forEach((day) => {
      const dayKey = day.date.toString();
      callbacks[dayKey] = () => toggleDayExpansion(dayKey);
    });
    return callbacks;
  }, [dailyAggregates, toggleDayExpansion]);

  // Memoize dot colors calculation
  const dotColors = useMemo(() => {
    return reversedAggregates.map((agg) => {
      const idx = Math.round(agg.finalAvg);
      return getColorFromTailwind(moodScale[idx]?.color);
    });
  }, [reversedAggregates]);

  // Memoize chart data
  const chartData = useMemo(
    () => ({
      labels: [...labels].reverse(), // Reverse labels to match reversed aggregates
      datasets: [
        {
          data: reversedAggregates.map((agg) => agg.finalAvg),
          dotColor: dotColors,
          strokeWidth: 2,
          color: (o = 1) => `rgba(255,255,255,${o})`,
        },
        {
          data: [0], // Min value for y-axis
          withDots: false,
        },
        {
          data: [10], // Max value for y-axis
          withDots: false,
        },
      ],
    }),
    [labels, reversedAggregates, dotColors]
  );

  return (
    <ScrollView
      className="flex-1 bg-transparent"
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={onRefresh} />
      }
    >
      <Text className="text-xl font-semibold text-center mb-1 text-blue-600 dark:text-blue-400 mx-4">
        📅 Daily Mood Analysis
      </Text>

      {/* Daily Statistics Summary */}
      <View className="mx-4 mb-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl shadow-sm">
        <Text className="text-lg font-semibold mb-3 text-gray-800 dark:text-slate-200">
          Daily Statistics
        </Text>
        <View className="flex-row justify-between mb-3">
          <View className="flex-1">
            <Text className="text-sm text-gray-500 dark:text-slate-400">
              Best Day
            </Text>
            <Text
              className={`text-lg font-bold ${
                getMoodInterpretation(dailyStats.bestDay).textClass
              }`}
            >
              {dailyStats.bestDay.toFixed(1)}
            </Text>
            <Text className="text-xs text-gray-400 dark:text-slate-500">
              {getMoodInterpretation(dailyStats.bestDay).text}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500 dark:text-slate-400">
              Challenging Day
            </Text>
            <Text
              className={`text-lg font-bold ${
                getMoodInterpretation(dailyStats.worstDay).textClass
              }`}
            >
              {dailyStats.worstDay.toFixed(1)}
            </Text>
            <Text className="text-xs text-gray-400 dark:text-slate-500">
              {getMoodInterpretation(dailyStats.worstDay).text}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500 dark:text-slate-400">
              Average
            </Text>
            <Text
              className={`text-lg font-bold ${
                getMoodInterpretation(dailyStats.averageDay).textClass
              }`}
            >
              {dailyStats.averageDay.toFixed(1)}
            </Text>
            <Text className="text-xs text-gray-400 dark:text-slate-500">
              {getMoodInterpretation(dailyStats.averageDay).text}
            </Text>
          </View>
        </View>
        <View className="flex-row justify-between">
          <View className="flex-1">
            <Text className="text-sm text-gray-500 dark:text-slate-400">
              Days Tracked
            </Text>
            <Text className="text-lg font-bold text-purple-600">
              {dailyStats.daysWithEntries}
            </Text>
            <Text className="text-xs text-gray-400 dark:text-slate-500">
              of {dailyStats.totalDays} days
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500 dark:text-slate-400">
              Consistency
            </Text>
            <Text className="text-lg font-bold text-teal-600">
              {(
                (dailyStats.daysWithEntries / dailyStats.totalDays) *
                100
              ).toFixed(0)}
              %
            </Text>
            <Text className="text-xs text-gray-400 dark:text-slate-500">
              tracking rate
            </Text>
          </View>
        </View>
      </View>

      {/* Recent Days Summary */}
      <View className="mx-4 mb-6">
        <Text className="text-lg font-semibold mb-1 text-gray-800 dark:text-slate-200">
          Recent Days
        </Text>
        <Text className="text-sm text-gray-500 dark:text-slate-400 mb-4">
          Tap any day to view detailed mood entries and notes
        </Text>
        {recentDaysAggregates.map((day, index) => {
          const dayKey = day.date.toString();
          const isExpanded = expandedDays.has(dayKey);
          const dayMoodEntries = moodEntriesByDay.get(dayKey) || [];

          return (
            <DayItem
              key={dayKey}
              day={day}
              dayMoodEntries={dayMoodEntries}
              isExpanded={isExpanded}
              onToggle={toggleCallbacks[dayKey]}
            />
          );
        })}
      </View>

      {/* Daily Chart */}
      <View className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 mx-4 p-4 rounded-2xl shadow-lg mb-6">
        <Text className="text-lg font-semibold mb-3 text-gray-800 dark:text-slate-200">
          Daily Mood Trend
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingVertical: 10 }}
        >
          <LineChart
            data={chartData}
            width={Math.max(
              Dimensions.get("window").width - 64,
              chartData.labels.length * 40
            )}
            height={300}
            chartConfig={getBaseChartConfig("#7986CB", "#5C6BC0", isDark)}
            style={{ borderRadius: 16 }}
            bezier
            segments={10}
            renderDotContent={({ x, y, index }) => {
              const agg = reversedAggregates[index];
              const startY = 240,
                endY = 15,
                split = Math.abs(startY - endY) / 10;
              const uniqueMoods = Array.from(new Set(agg.moods ?? []));
              const moodCircles = uniqueMoods.map((val) => (
                <Circle
                  key={`m-${index}-${val}`}
                  cx={x}
                  cy={startY - split * val}
                  r="3"
                  fill={getColorFromTailwind(moodScale[val].color)}
                  stroke={getColorFromTailwind(moodScale[val].color)}
                />
              ));
              const y1 = startY - split * (agg.min ?? agg.finalAvg);
              const y2 = startY - split * (agg.max ?? agg.finalAvg);
              const lineEl =
                agg.min !== undefined && agg.max !== undefined ? (
                  <Line
                    x1={x}
                    x2={x}
                    y1={y1}
                    y2={y2}
                    stroke={dotColors[index]}
                    strokeWidth="3"
                  />
                ) : null;
              return (
                <React.Fragment key={index}>
                  {lineEl}
                  {moodCircles}
                  <Circle
                    cx={x}
                    cy={y}
                    r="5"
                    fill={dotColors[index]}
                    stroke={dotColors[index]}
                    strokeWidth="1"
                  />
                </React.Fragment>
              );
            }}
          />
        </ScrollView>
      </View>

      {/* Daily Patterns Analysis */}
      <View className="mx-4 mb-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl shadow-sm">
        <Text className="text-lg font-semibold mb-3 text-gray-800 dark:text-slate-200">
          Patterns & Insights
        </Text>

        <View className="mb-3">
          <Text className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
            Most Consistent Period
          </Text>
          <Text className="text-sm text-gray-600 dark:text-slate-400">
            Last 7 days have{" "}
            {dailyStats.daysWithEntries >= 5 ? "excellent" : "good"} tracking
            consistency
          </Text>
        </View>

        <View className="mb-3">
          <Text className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
            Trend Direction
          </Text>
          <Text className="text-sm text-gray-600 dark:text-slate-400">
            {reversedAggregates.length >= 7
              ? reversedAggregates
                  .slice(0, 3)
                  .reduce((sum, d) => sum + d.finalAvg, 0) /
                  3 <
                reversedAggregates
                  .slice(-3)
                  .reduce((sum, d) => sum + d.finalAvg, 0) /
                  3
                ? "Recent days show improvement compared to a week ago"
                : "Consider what might help improve recent patterns"
              : "More data needed for trend analysis"}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};
