import React from "react";
import { View, Text, ScrollView, Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { format, endOfWeek } from "date-fns";
import type { MoodEntry } from "@db/types";
import { moodScale } from "@/constants/moodScale";
import type { MoodScale } from "@/types/mood";
import {
  processWeeklyMoodData,
  getBaseChartConfig,
  getMoodInterpretation,
  getTrendInterpretation,
} from "./ChartComponents";

export const WeeklyTab = ({ moods }: { moods: MoodEntry[] }) => {
  const weeklyData = processWeeklyMoodData(moods);

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
    <ScrollView className="flex-1">
      <Text className="text-xl font-semibold text-center mb-1 text-emerald-600 mx-4">
        📊 Weekly Mood Analysis
      </Text>
      <Text className="text-sm text-gray-500 text-center mb-4 mx-4">
        {weeklyData.weeklyAggregates.length} weeks of data • Detailed insights
        and patterns
      </Text>

      {/* Enhanced Weekly Statistics Summary */}
      <View className="mx-4 mb-6 bg-white p-4 rounded-xl shadow-sm">
        <Text className="text-lg font-semibold mb-3 text-gray-800">
          📊 Weekly Overview
        </Text>

        {/* Primary Stats */}
        <View className="flex-row justify-between mb-4">
          <View className="flex-1">
            <Text className="text-sm text-gray-500">Best Week</Text>
            <Text className="text-lg font-bold text-green-600">
              {Math.min(
                ...weeklyData.weeklyAggregates.map((w) => w.avg)
              ).toFixed(1)}
            </Text>
            <Text className="text-xs text-green-500">
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
            <Text className="text-sm text-gray-500">Most Challenging</Text>
            <Text className="text-lg font-bold text-red-600">
              {Math.max(
                ...weeklyData.weeklyAggregates.map((w) => w.avg)
              ).toFixed(1)}
            </Text>
            <Text className="text-xs text-red-500">
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
            <Text className="text-sm text-gray-500">Overall Average</Text>
            <Text className="text-lg font-bold text-blue-600">
              {(
                weeklyData.weeklyAggregates.reduce((sum, w) => sum + w.avg, 0) /
                weeklyData.weeklyAggregates.length
              ).toFixed(1)}
            </Text>
            <Text className="text-xs text-blue-500">
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
        <View className="bg-gray-50 p-3 rounded-lg">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            💡 Key Insights:
          </Text>

          {/* Consistency Score */}
          <View className="flex-row justify-between mb-1">
            <Text className="text-xs text-gray-600">Consistency Score:</Text>
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
                  <Text className="text-xs text-gray-600">Recent Trend:</Text>
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
        <Text className="text-lg font-semibold mb-1 text-gray-800">
          🗓️ Week-by-Week Details
        </Text>
        <Text className="text-sm text-gray-500 mb-4">
          Explore each week's mood patterns, distribution, and insights
        </Text>
      </View>

      <View className="mb-6">
        {weeklyData.weeklyAggregates.slice(0, 8).map((week, index) => {
          const prevWeek = weeklyData.weeklyAggregates[index + 1];
          const trend = prevWeek ? week.avg - prevWeek.avg : 0;
          const interpretation = getMoodInterpretation(week.avg);
          const trendInterpretation = getTrendInterpretation(trend);

          return (
            <View
              key={week.weekStart.toString()}
              className="bg-white mx-4 p-4 rounded-xl mb-3 shadow-sm"
            >
              <View className="flex-row justify-between items-center">
                <View className="flex-1">
                  <Text className="font-semibold text-gray-800">
                    {format(week.weekStart, "MMM dd")} -{" "}
                    {format(
                      endOfWeek(week.weekStart, { weekStartsOn: 1 }),
                      "MMM dd"
                    )}
                  </Text>
                  <Text className="text-sm text-gray-500 mb-2">
                    {week.moods.length} entries • Range: {week.min}-{week.max}
                  </Text>
                  <View className="flex-row">
                    <View
                      className={`px-2 py-1 rounded mr-2 ${
                        interpretation.color === "green"
                          ? "bg-green-100"
                          : interpretation.color === "blue"
                          ? "bg-blue-100"
                          : interpretation.color === "yellow"
                          ? "bg-yellow-100"
                          : interpretation.color === "orange"
                          ? "bg-orange-100"
                          : "bg-red-100"
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          interpretation.color === "green"
                            ? "text-green-700"
                            : interpretation.color === "blue"
                            ? "text-blue-700"
                            : interpretation.color === "yellow"
                            ? "text-yellow-700"
                            : interpretation.color === "orange"
                            ? "text-orange-700"
                            : "text-red-700"
                        }`}
                      >
                        {interpretation.text}
                      </Text>
                    </View>
                  </View>
                </View>
                <View className="items-end">
                  <Text
                    className={`text-2xl font-bold ${
                      interpretation.color === "green"
                        ? "text-green-600"
                        : interpretation.color === "blue"
                        ? "text-blue-600"
                        : interpretation.color === "yellow"
                        ? "text-yellow-600"
                        : interpretation.color === "orange"
                        ? "text-orange-600"
                        : "text-red-600"
                    }`}
                  >
                    {week.avg.toFixed(1)}
                  </Text>
                  {prevWeek && (
                    <Text
                      className={`text-xs mt-1 ${
                        trendInterpretation.color === "green"
                          ? "text-green-500"
                          : trendInterpretation.color === "blue"
                          ? "text-blue-500"
                          : trendInterpretation.color === "red"
                          ? "text-red-500"
                          : trendInterpretation.color === "orange"
                          ? "text-orange-500"
                          : "text-gray-400"
                      }`}
                    >
                      {trend < 0 ? "↗️ " : trend > 0 ? "↘️ " : "➡️ "}
                      {Math.abs(trend).toFixed(1)}
                    </Text>
                  )}
                </View>
              </View>

              {/* Enhanced Mood distribution for this week */}
              <View className="mt-3 pt-3 border-t border-gray-100">
                <Text className="text-xs text-gray-500 mb-3">
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
                        <View className="bg-gray-200 h-2 rounded-full overflow-hidden">
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
                <View className="bg-gray-50 p-3 rounded-lg">
                  <Text className="text-xs font-medium text-gray-700 mb-2">
                    📈 Weekly Insights:
                  </Text>

                  {/* Mood Stability */}
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-xs text-gray-600">
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
                        <Text className="text-xs text-gray-600">
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
                    <Text className="text-xs text-gray-600">Daily Range:</Text>
                    <Text className="text-xs font-medium text-gray-700">
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
      <View className="bg-white mx-4 p-4 rounded-2xl shadow-lg mb-6">
        <Text className="text-lg font-semibold mb-1 text-gray-800">
          📈 Weekly Mood Trend
        </Text>
        <Text className="text-sm text-gray-500 mb-3">
          Track your mood patterns over time • Lower is better
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <LineChart
            data={chartData}
            width={Math.max(
              Dimensions.get("window").width - 32,
              weeklyData.labels.length * 80
            )}
            height={300}
            chartConfig={getBaseChartConfig("#10B981", "#059669")}
            style={{ borderRadius: 16 }}
            bezier
            segments={10}
          />
        </ScrollView>

        {/* Chart Legend */}
        <View className="mt-3 pt-3 border-t border-gray-100">
          <Text className="text-xs text-gray-500 text-center">
            💡 Tip: Look for patterns in your weekly averages to identify
            triggers and positive trends
          </Text>
        </View>
      </View>

      {/* Overall Weekly Summary & Recommendations */}
      <View className="bg-gradient-to-br from-emerald-50 to-teal-50 mx-4 p-4 rounded-2xl shadow-sm mb-6">
        <Text className="text-lg font-semibold mb-3 text-emerald-800">
          🎯 Weekly Summary & Insights
        </Text>

        {/* Data Quality */}
        <View className="bg-white p-3 rounded-lg mb-3">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            📊 Tracking Quality:
          </Text>
          <View className="flex-row justify-between">
            <Text className="text-xs text-gray-600">
              Total weeks tracked: {weeklyData.weeklyAggregates.length}
            </Text>
            <Text className="text-xs text-gray-600">
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
        <View className="bg-white p-3 rounded-lg">
          <Text className="text-sm font-medium text-gray-700 mb-2">
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
              <Text key={index} className="text-xs text-gray-600 mb-1">
                {rec}
              </Text>
            ));
          })()}
        </View>
      </View>
    </ScrollView>
  );
};
