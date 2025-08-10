import React, { useState } from "react";
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
  endOfWeek,
  startOfWeek,
  endOfWeek as getEndOfWeek,
  isWithinInterval,
} from "date-fns";
import type { MoodEntry } from "@db/types";
import { moodScale } from "@/constants/moodScale";
import type { MoodScale } from "@/types/mood";
import {
  processWeeklyMoodData,
  getBaseChartConfig,
  getMoodInterpretation,
  getTrendInterpretation,
} from "./ChartComponents";
import { useColorScheme } from "@/hooks/useColorScheme";

export const WeeklyTab = ({
  moods,
  onRefresh,
}: {
  moods: MoodEntry[];
  onRefresh: () => void;
}) => {
  const weeklyData = processWeeklyMoodData(moods);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const [refreshing, setRefreshing] = React.useState(false);
  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    onRefresh();
    setRefreshing(false);
  }, [onRefresh]);

  // Helper function to get mood entries for a specific week
  const getMoodEntriesForWeek = (weekStart: Date): MoodEntry[] => {
    const weekEnd = getEndOfWeek(weekStart, { weekStartsOn: 1 });
    return moods
      .filter((mood) => {
        const moodDate = new Date(mood.timestamp);
        return isWithinInterval(moodDate, { start: weekStart, end: weekEnd });
      })
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  };

  const toggleWeekExpansion = (weekKey: string) => {
    const newExpandedWeeks = new Set(expandedWeeks);
    if (newExpandedWeeks.has(weekKey)) {
      newExpandedWeeks.delete(weekKey);
    } else {
      newExpandedWeeks.add(weekKey);
    }
    setExpandedWeeks(newExpandedWeeks);
  };

  if (!weeklyData.weeklyAggregates.length) {
    return (
      <View className="flex-1 justify-center items-center p-8">
        <Text className="text-gray-500 text-center text-lg">
          No weekly data available yet
        </Text>
      </View>
    );
  }

  const chartData = {
    labels: weeklyData.labels,
    datasets: [
      {
        data: weeklyData.weeklyAggregates.map((week) => week.avg),
        strokeWidth: 3,
        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
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
  };

  return (
    <ScrollView
      className="flex-1 bg-transparent"
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={onRefresh} />
      }
    >
      <Text className="text-xl font-semibold text-center mb-1 text-emerald-600 dark:text-emerald-400 mx-4">
        📊 Weekly Mood Analysis
      </Text>
      <Text className="text-sm text-gray-500 dark:text-slate-400 text-center mb-4 mx-4">
        {weeklyData.weeklyAggregates.length} weeks of data • Detailed insights
        and patterns
      </Text>

      {/* Enhanced Weekly Statistics Summary */}
      <View className="mx-4 mb-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl shadow-sm">
        <Text className="text-lg font-semibold mb-3 text-gray-800 dark:text-slate-200">
          📊 Weekly Overview
        </Text>

        {/* Primary Stats */}
        <View className="flex-row justify-between mb-4">
          <View className="flex-1">
            <Text className="text-sm text-gray-500 dark:text-slate-400">
              Best Week
            </Text>
            <Text
              className={`text-lg font-bold ${
                getMoodInterpretation(
                  Math.min(...weeklyData.weeklyAggregates.map((w) => w.avg))
                ).textClass
              }`}
            >
              {Math.min(
                ...weeklyData.weeklyAggregates.map((w) => w.avg)
              ).toFixed(1)}
            </Text>
            <Text
              className={`text-xs ${
                moodScale.find(
                  (m: MoodScale) =>
                    m.value ===
                    Math.round(
                      Math.min(...weeklyData.weeklyAggregates.map((w) => w.avg))
                    )
                )?.color || "text-green-500"
              }`}
            >
              {moodScale.find(
                (m: MoodScale) =>
                  m.value ===
                  Math.round(
                    Math.min(...weeklyData.weeklyAggregates.map((w) => w.avg))
                  )
              )?.label || "Good"}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500 dark:text-slate-400">
              Most Challenging
            </Text>
            <Text
              className={`text-lg font-bold ${
                getMoodInterpretation(
                  Math.max(...weeklyData.weeklyAggregates.map((w) => w.avg))
                ).textClass
              }`}
            >
              {Math.max(
                ...weeklyData.weeklyAggregates.map((w) => w.avg)
              ).toFixed(1)}
            </Text>
            <Text
              className={`text-xs ${
                moodScale.find(
                  (m: MoodScale) =>
                    m.value ===
                    Math.round(
                      Math.max(...weeklyData.weeklyAggregates.map((w) => w.avg))
                    )
                )?.color || "text-red-500"
              }`}
            >
              {moodScale.find(
                (m: MoodScale) =>
                  m.value ===
                  Math.round(
                    Math.max(...weeklyData.weeklyAggregates.map((w) => w.avg))
                  )
              )?.label || "Difficult"}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500 dark:text-slate-400">
              Overall Average
            </Text>
            <Text
              className={`text-lg font-bold ${
                getMoodInterpretation(
                  weeklyData.weeklyAggregates.reduce(
                    (sum, w) => sum + w.avg,
                    0
                  ) / weeklyData.weeklyAggregates.length
                ).textClass
              }`}
            >
              {(
                weeklyData.weeklyAggregates.reduce((sum, w) => sum + w.avg, 0) /
                weeklyData.weeklyAggregates.length
              ).toFixed(1)}
            </Text>
            <Text
              className={`text-xs ${
                moodScale.find(
                  (m: MoodScale) =>
                    m.value ===
                    Math.round(
                      weeklyData.weeklyAggregates.reduce(
                        (sum, w) => sum + w.avg,
                        0
                      ) / weeklyData.weeklyAggregates.length
                    )
                )?.color || "text-blue-500"
              }`}
            >
              {moodScale.find(
                (m: MoodScale) =>
                  m.value ===
                  Math.round(
                    weeklyData.weeklyAggregates.reduce(
                      (sum, w) => sum + w.avg,
                      0
                    ) / weeklyData.weeklyAggregates.length
                  )
              )?.label || "Average"}
            </Text>
          </View>
        </View>

        {/* Additional Insights */}
        <View className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
          <Text className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
            💡 Key Insights:
          </Text>

          {/* Consistency Score */}
          <View className="flex-row justify-between mb-1">
            <Text className="text-xs text-gray-600 dark:text-slate-400">
              Consistency Score:
            </Text>
            <Text
              className={`text-xs font-medium ${
                weeklyData.weeklyAggregates.length >= 7
                  ? "text-green-600"
                  : weeklyData.weeklyAggregates.length >= 5
                  ? "text-yellow-600"
                  : "text-red-600"
              }`}
            >
              {weeklyData.weeklyAggregates.length >= 7
                ? "Excellent"
                : weeklyData.weeklyAggregates.length >= 5
                ? "Good"
                : "Building Habit"}
            </Text>
          </View>

          {/* Progress Trend */}
          {weeklyData.weeklyAggregates.length >= 2 &&
            (() => {
              const recentWeeks = weeklyData.weeklyAggregates.slice(0, 4);
              const olderWeeks = weeklyData.weeklyAggregates.slice(4, 8);
              const recentAvg =
                recentWeeks.reduce((sum, w) => sum + w.avg, 0) /
                recentWeeks.length;
              const olderAvg =
                olderWeeks.length > 0
                  ? olderWeeks.reduce((sum, w) => sum + w.avg, 0) /
                    olderWeeks.length
                  : recentAvg;
              const trend = recentAvg - olderAvg;

              return (
                <View className="flex-row justify-between">
                  <Text className="text-xs text-gray-600 dark:text-slate-400">
                    Recent Trend:
                  </Text>
                  <Text
                    className={`text-xs font-medium ${
                      trend < -0.5
                        ? "text-green-600"
                        : trend > 0.5
                        ? "text-red-600"
                        : "text-gray-600"
                    }`}
                  >
                    {trend < -0.5
                      ? "📈 Improving"
                      : trend > 0.5
                      ? "📉 Declining"
                      : "➡️ Stable"}
                  </Text>
                </View>
              );
            })()}
        </View>
      </View>

      {/* Detailed Weekly Breakdown */}
      <View className="mb-2 mx-4">
        <Text className="text-lg font-semibold mb-1 text-gray-800 dark:text-slate-200">
          🗓️ Week-by-Week Details
        </Text>
        <Text className="text-sm text-gray-500 dark:text-slate-400 mb-4">
          Tap any week to view detailed mood entries and notes
        </Text>
      </View>

      <View className="mb-6">
        {weeklyData.weeklyAggregates.slice(0, 8).map((week, index) => {
          const prevWeek = weeklyData.weeklyAggregates[index + 1];
          const trend = prevWeek ? week.avg - prevWeek.avg : 0;
          const interpretation = getMoodInterpretation(week.avg);
          const trendInterpretation = getTrendInterpretation(trend);
          const weekKey = week.weekStart.toString();
          const isExpanded = expandedWeeks.has(weekKey);
          const weekMoodEntries = getMoodEntriesForWeek(week.weekStart);

          return (
            <View
              key={weekKey}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 mx-4 p-4 rounded-xl mb-3 shadow-sm"
            >
              <TouchableOpacity
                onPress={() => toggleWeekExpansion(weekKey)}
                className="flex-row justify-between items-center"
                activeOpacity={0.7}
              >
                <View className="flex-1">
                  <Text className="font-semibold text-gray-800 dark:text-slate-200">
                    {format(week.weekStart, "MMM dd")} -{" "}
                    {format(
                      endOfWeek(week.weekStart, { weekStartsOn: 1 }),
                      "MMM dd"
                    )}
                  </Text>
                  <Text className="text-sm text-gray-500 dark:text-slate-400 mb-2">
                    {week.moods.length} entries • Range: {week.min}-{week.max}
                  </Text>
                  <View className="flex-row">
                    <View
                      className={`px-2 py-1 rounded mr-2 ${interpretation.bgClass}`}
                    >
                      <Text
                        className={`text-xs font-medium ${interpretation.textClass
                          .replace("500", "700")
                          .replace("600", "700")}`}
                      >
                        {interpretation.text}
                      </Text>
                    </View>
                  </View>
                </View>
                <View className="items-end">
                  <Text
                    className={`text-2xl font-bold ${interpretation.textClass}`}
                  >
                    {week.avg.toFixed(1)}
                  </Text>
                  {prevWeek && (
                    <Text
                      className={`text-xs mt-1 ${trendInterpretation.textClass}`}
                    >
                      {trend < 0 ? "- " : trend > 0 ? "+ " : "➡️ "}
                      {Math.abs(trend).toFixed(1)}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>

              {/* Accordion Content - Mood Entries */}
              {isExpanded && (
                <View className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                  <Text className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-3">
                    📝 Mood Entries for this Week:
                  </Text>
                  {weekMoodEntries.length > 0 ? (
                    <View className="space-y-2">
                      {[...weekMoodEntries]
                        .sort(
                          (a, b) =>
                            new Date(b.timestamp).getTime() -
                            new Date(a.timestamp).getTime()
                        )
                        .map((entry) => {
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
                                          entryMoodInfo?.color ||
                                          "text-gray-600"
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
                                            entryMoodInfo?.color ||
                                            "text-gray-600"
                                          }`}
                                        >
                                          {entryMoodInfo?.label ||
                                            `Mood ${entry.mood}`}
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
                                        {format(
                                          new Date(entry.timestamp),
                                          "dd/MM HH:mm"
                                        )}
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
                      No detailed entries available for this week.
                    </Text>
                  )}
                </View>
              )}

              {/* Enhanced Mood distribution for this week */}
              <View className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                <Text className="text-xs text-gray-500 dark:text-slate-400 mb-3">
                  Mood Distribution & Patterns:
                </Text>

                {/* Mood Distribution Bars */}
                <View className="mb-3">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((moodValue) => {
                    const count = week.moods.filter(
                      (m) => m === moodValue
                    ).length;
                    const percentage = (count / week.moods.length) * 100;
                    const moodInfo = moodScale.find(
                      (m: MoodScale) => m.value === moodValue
                    );

                    if (count === 0) return null;

                    return (
                      <View key={moodValue} className="mb-2">
                        <View className="flex-row justify-between items-center mb-1">
                          <Text
                            className={`text-xs font-medium ${
                              moodInfo?.color || "text-gray-600"
                            }`}
                          >
                            {moodInfo?.label || `Mood ${moodValue}`}
                          </Text>
                          <Text className="text-xs text-gray-500">
                            {count} ({percentage.toFixed(0)}%)
                          </Text>
                        </View>
                        <View className="bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                          <View
                            className={`h-full rounded-full ${
                              moodInfo?.bg || "bg-gray-300"
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Weekly Insights */}
                <View className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
                  <Text className="text-xs font-medium text-gray-700 dark:text-slate-200 mb-2">
                    📈 Weekly Insights:
                  </Text>

                  {/* Mood Stability */}
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-xs text-gray-600 dark:text-slate-400">
                      Mood Stability:
                    </Text>
                    <Text
                      className={`text-xs font-medium ${
                        week.max - week.min <= 1
                          ? "text-green-600"
                          : week.max - week.min <= 3
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}
                    >
                      {week.max - week.min <= 1
                        ? "Very Stable"
                        : week.max - week.min <= 3
                        ? "Moderate"
                        : "Variable"}
                    </Text>
                  </View>

                  {/* Most Common Mood */}
                  {(() => {
                    const moodCounts = week.moods.reduce((acc, mood) => {
                      acc[mood] = (acc[mood] || 0) + 1;
                      return acc;
                    }, {} as Record<number, number>);

                    const mostCommonMood = Object.entries(moodCounts).sort(
                      ([, a], [, b]) => b - a
                    )[0];

                    const moodInfo = moodScale.find(
                      (m: MoodScale) => m.value === parseInt(mostCommonMood[0])
                    );

                    return (
                      <View className="flex-row justify-between mb-1">
                        <Text className="text-xs text-gray-600 dark:text-slate-400">
                          Most Common:
                        </Text>
                        <Text
                          className={`text-xs font-medium ${
                            moodInfo?.color || "text-gray-600"
                          }`}
                        >
                          {moodInfo?.label || `Mood ${mostCommonMood[0]}`}
                        </Text>
                      </View>
                    );
                  })()}

                  {/* Mood Range */}
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-gray-600 dark:text-slate-400">
                      Daily Range:
                    </Text>
                    <Text className="text-xs font-medium text-gray-700 dark:text-slate-300">
                      {week.min} - {week.max} (span: {week.max - week.min})
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Weekly Trend Chart */}
      <View className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 mx-4 p-4 rounded-2xl shadow-lg mb-6">
        <Text className="text-lg font-semibold mb-1 text-gray-800 dark:text-slate-200">
          📈 Weekly Mood Trend
        </Text>
        <Text className="text-sm text-gray-500 dark:text-slate-400 mb-3">
          Track your mood patterns over time • Lower is better
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
              chartData.labels.length * 60
            )}
            height={300}
            chartConfig={getBaseChartConfig("#10B981", "#059669", isDark)}
            style={{ borderRadius: 16 }}
            bezier
            segments={10}
          />
        </ScrollView>

        {/* Chart Legend */}
        <View className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
          <Text className="text-xs text-gray-500 dark:text-slate-400 text-center">
            💡 Tip: Look for patterns in your weekly averages to identify
            triggers and positive trends
          </Text>
        </View>
      </View>

      {/* Overall Weekly Summary & Recommendations */}
      <View className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 mx-4 p-4 rounded-2xl shadow-sm mb-6">
        <Text className="text-lg font-semibold mb-3 text-emerald-800 dark:text-emerald-300">
          🎯 Weekly Summary & Insights
        </Text>

        {/* Data Quality */}
        <View className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg mb-3">
          <Text className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
            📊 Tracking Quality:
          </Text>
          <View className="flex-row justify-between">
            <Text className="text-xs text-gray-600 dark:text-slate-400">
              Total weeks tracked: {weeklyData.weeklyAggregates.length}
            </Text>
            <Text className="text-xs text-gray-600 dark:text-slate-400">
              Avg entries/week:{" "}
              {(
                weeklyData.weeklyAggregates.reduce(
                  (sum, w) => sum + w.moods.length,
                  0
                ) / weeklyData.weeklyAggregates.length
              ).toFixed(1)}
            </Text>
          </View>
        </View>

        {/* Actionable Insights */}
        <View className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
          <Text className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
            💡 Recommendations:
          </Text>

          {(() => {
            const avgVariability =
              weeklyData.weeklyAggregates.reduce(
                (sum, w) => sum + (w.max - w.min),
                0
              ) / weeklyData.weeklyAggregates.length;
            const recentWeeks = weeklyData.weeklyAggregates.slice(0, 2);
            const avgEntries =
              weeklyData.weeklyAggregates.reduce(
                (sum, w) => sum + w.moods.length,
                0
              ) / weeklyData.weeklyAggregates.length;

            let recommendations = [];

            if (avgVariability > 5) {
              recommendations.push(
                "• Consider identifying triggers for mood swings"
              );
            }
            if (avgEntries < 4) {
              recommendations.push(
                "• Try tracking mood more frequently for better insights"
              );
            }
            if (
              recentWeeks.length >= 2 &&
              recentWeeks[0].avg > recentWeeks[1].avg + 1
            ) {
              recommendations.push(
                "• Recent weeks show improvement - keep up the good work!"
              );
            }
            if (weeklyData.weeklyAggregates.length >= 4) {
              recommendations.push(
                "• Great consistency! Your data shows meaningful patterns"
              );
            }

            if (recommendations.length === 0) {
              recommendations.push(
                "• Keep tracking consistently to build valuable insights"
              );
            }

            return recommendations.map((rec, index) => (
              <Text
                key={index}
                className="text-xs text-gray-600 dark:text-slate-400 mb-1"
              >
                {rec}
              </Text>
            ));
          })()}
        </View>
      </View>
    </ScrollView>
  );
};
