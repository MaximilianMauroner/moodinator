import React from "react";
import { View, Text, ScrollView } from "react-native";
import { endOfWeek, format } from "date-fns";
import type { MoodEntry } from "@db/types";
import { moodScale } from "@/constants/moodScale";
import {
  processWeeklyMoodData,
  MiniWeeklyChart,
  getMoodInterpretation,
  getTrendInterpretation,
} from "./ChartComponents";

export const OverviewTab = ({ moods }: { moods: MoodEntry[] }) => {
  const weeklyData = processWeeklyMoodData(moods);
  const recentWeeks = weeklyData.weeklyAggregates.slice(0, 4); // Last 4 weeks

  const currentWeekAvg = recentWeeks[0]?.avg || 0;
  const lastWeekAvg = recentWeeks[1]?.avg || 0;
  // Remember: lower number = improvement (since higher numbers are worse)
  const weeklyTrend = currentWeekAvg - lastWeekAvg;

  const overallAvg =
    moods.reduce((sum, mood) => sum + mood.mood, 0) / moods.length;
  const currentInterpretation = getMoodInterpretation(currentWeekAvg);
  const lastInterpretation = getMoodInterpretation(lastWeekAvg);
  const trendInterpretation = getTrendInterpretation(weeklyTrend);

  return (
    <ScrollView className="flex-1">
      {/* Weekly Comparison Card */}
      <View className="mx-4 mb-6 p-6 bg-white rounded-2xl shadow-lg">
        <Text className="text-xl font-bold text-gray-800 mb-4 text-center">
          📈 This Week vs Last Week
        </Text>

        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-1 items-center">
            <Text className="text-sm text-gray-500 mb-1">This Week</Text>
            <Text
              className={`text-3xl font-bold ${currentInterpretation.textClass}`}
            >
              {currentWeekAvg.toFixed(1)}
            </Text>
            <Text className="text-xs text-gray-400">
              {currentInterpretation.text}
            </Text>
          </View>

          <View className="items-center px-4">
            <Text
              className={`text-2xl font-bold ${trendInterpretation.textClass}`}
            >
              {weeklyTrend < 0 ? "↗️" : weeklyTrend > 0 ? "↘️" : "➡️"}
            </Text>
            <Text
              className={`text-sm font-semibold ${trendInterpretation.textClass}`}
            >
              {weeklyTrend > 0 ? "+" : ""}
              {weeklyTrend.toFixed(1)}
            </Text>
          </View>

          <View className="flex-1 items-center">
            <Text className="text-sm text-gray-500 mb-1">Last Week</Text>
            <Text
              className={`text-3xl font-bold ${lastInterpretation.textClass}`}
            >
              {lastWeekAvg.toFixed(1)}
            </Text>
            <Text className="text-xs text-gray-400">
              {lastInterpretation.text}
            </Text>
          </View>
        </View>

        <View className={`p-3 rounded-xl ${trendInterpretation.bgClass}`}>
          <Text
            className={`text-center font-medium ${trendInterpretation.textClass.replace(
              "500",
              "700"
            )}`}
          >
            {trendInterpretation.emoji} {trendInterpretation.text}
          </Text>
        </View>
      </View>

      {/* Quick Stats */}
      <View className="mx-4 mb-6">
        <View className="flex-row">
          <View className="flex-1 bg-white p-4 rounded-xl mr-2 shadow-sm">
            <Text
              className={`text-center text-2xl font-bold ${
                getMoodInterpretation(overallAvg).textClass
              }`}
            >
              {overallAvg.toFixed(1)}
            </Text>
            <Text className="text-center text-xs text-gray-500 mt-1">
              Overall Average
            </Text>
            <Text className="text-center text-xs text-gray-400">
              {getMoodInterpretation(overallAvg).text}
            </Text>
          </View>
          <View className="flex-1 bg-white p-4 rounded-xl ml-2 shadow-sm">
            <Text className="text-center text-2xl font-bold text-purple-600">
              {moods.length}
            </Text>
            <Text className="text-center text-xs text-gray-500 mt-1">
              Total Entries
            </Text>
            <Text className="text-center text-xs text-gray-400">
              {recentWeeks.length} weeks tracked
            </Text>
          </View>
        </View>
      </View>

      {/* Recent Week Summary */}
      <View className="mx-4 mb-6">
        <Text className="text-lg font-semibold mb-3 text-gray-800">
          Recent Weeks
        </Text>
        {recentWeeks.slice(0, 3).map((week, index) => {
          const interpretation = getMoodInterpretation(week.avg);
          return (
            <View
              key={week.weekStart.toString()}
              className="bg-white p-4 rounded-xl mb-3 shadow-sm"
            >
              <View className="flex-row justify-between items-center">
                <View>
                  <Text className="font-semibold text-gray-800">
                    Week of {format(week.weekStart, "MMM dd")} -{" "}
                    {format(
                      endOfWeek(week.weekStart, { weekStartsOn: 1 }),
                      "MMM dd"
                    )}
                  </Text>
                  <Text className="text-sm text-gray-500">
                    {week.moods.length} entries • Avg: {week.avg.toFixed(1)}
                  </Text>
                </View>
                <View className="items-end">
                  <View
                    className={`px-3 py-1 rounded-full ${interpretation.bgClass}`}
                  >
                    <Text
                      className={`text-sm font-medium ${interpretation.textClass
                        .replace("500", "700")
                        .replace("600", "700")}`}
                    >
                      {interpretation.text}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Mini Weekly Chart */}
      {recentWeeks.length > 0 && <MiniWeeklyChart weeklyData={recentWeeks} />}
    </ScrollView>
  );
};
