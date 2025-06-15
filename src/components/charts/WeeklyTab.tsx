import React from "react";
import { View, Text, ScrollView, Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { format, endOfWeek } from "date-fns";
import type { MoodEntry } from "@db/types";
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
      <Text className="text-xl font-semibold text-center mb-4 text-emerald-600 mx-4">
        📊 Weekly Mood Analysis
      </Text>

      {/* Weekly Statistics Summary */}
      <View className="mx-4 mb-6 bg-white p-4 rounded-xl shadow-sm">
        <Text className="text-lg font-semibold mb-3 text-gray-800">
          Weekly Statistics
        </Text>
        <View className="flex-row justify-between">
          <View className="flex-1">
            <Text className="text-sm text-gray-500">Best Week</Text>
            <Text className="text-lg font-bold text-green-600">
              {Math.min(
                ...weeklyData.weeklyAggregates.map((w) => w.avg)
              ).toFixed(1)}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500">Challenging Week</Text>
            <Text className="text-lg font-bold text-red-600">
              {Math.max(
                ...weeklyData.weeklyAggregates.map((w) => w.avg)
              ).toFixed(1)}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-500">Average</Text>
            <Text className="text-lg font-bold text-blue-600">
              {(
                weeklyData.weeklyAggregates.reduce((sum, w) => sum + w.avg, 0) /
                weeklyData.weeklyAggregates.length
              ).toFixed(1)}
            </Text>
          </View>
        </View>
      </View>

      {/* Weekly Comparison Cards */}
      <View className="mb-6">
        {weeklyData.weeklyAggregates.slice(0, 6).map((week, index) => {
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
                    {format(endOfWeek(week.weekStart), "MMM dd")}
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

              {/* Mood distribution for this week */}
              <View className="mt-3 pt-3 border-t border-gray-100">
                <Text className="text-xs text-gray-500 mb-2">
                  Mood Distribution:
                </Text>
                <View className="flex-row flex-wrap">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((moodValue) => {
                    const count = week.moods.filter(
                      (m) => m === moodValue
                    ).length;
                    if (count === 0) return null;
                    return (
                      <View key={moodValue} className="mr-2 mb-1">
                        <Text className="text-xs text-gray-600">
                          {moodValue}: {count}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Weekly Chart */}
      <View className="bg-white mx-4 p-4 rounded-2xl shadow-lg mb-6">
        <Text className="text-lg font-semibold mb-3 text-gray-800">
          Weekly Trend
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
      </View>
    </ScrollView>
  );
};
