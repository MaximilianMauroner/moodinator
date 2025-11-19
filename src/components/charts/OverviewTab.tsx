import React from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { endOfWeek, format } from "date-fns";
import type { MoodEntry } from "@db/types";
import {
  processWeeklyMoodData,
  MiniWeeklyChart,
  getMoodInterpretation,
  getTrendInterpretation,
} from "./ChartComponents";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Ionicons } from "@expo/vector-icons";

export const OverviewTab = ({
  moods,
  onRefresh,
}: {
  moods: MoodEntry[];
  onRefresh: () => void;
}) => {
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
    <ScrollView
      className="flex-1 bg-transparent"
      contentContainerStyle={{ paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={onRefresh} />
      }
    >
      {/* Weekly Comparison Card */}
      <View className="mx-4 mb-4 p-5 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <View className="flex-row items-center justify-between mb-6">
            <Text className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Weekly Pulse
            </Text>
            <View className={`px-3 py-1 rounded-full ${trendInterpretation.bgClass}`}>
            <Text
                className={`text-xs font-bold ${trendInterpretation.textClass.replace(
                "500",
                "700"
                )}`}
            >
                {trendInterpretation.emoji} {trendInterpretation.text}
            </Text>
            </View>
        </View>

        <View className="flex-row justify-between items-end">
          <View className="flex-1">
            <Text className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              This Week
            </Text>
            <View className="flex-row items-baseline gap-2">
                <Text
                className={`text-4xl font-extrabold ${currentInterpretation.textClass}`}
                >
                {currentWeekAvg.toFixed(1)}
                </Text>
                 <Text className="text-sm font-medium text-slate-400 dark:text-slate-500 mb-1">
                    / 10
                </Text>
            </View>
            <Text className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              {currentInterpretation.text}
            </Text>
          </View>

          <View className="h-12 w-[1px] bg-slate-100 dark:bg-slate-800 mx-4" />

          <View className="flex-1">
            <Text className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Last Week
            </Text>
            <Text
              className={`text-2xl font-bold ${lastInterpretation.textClass} opacity-80`}
            >
              {lastWeekAvg.toFixed(1)}
            </Text>
             <Text className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              {lastInterpretation.text}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Stats */}
      <View className="mx-4 mb-4 flex-row gap-3">
        <View className="flex-1 bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <View className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-full items-center justify-center mb-2">
             <Ionicons name="analytics" size={16} color="#3b82f6" />
          </View>
          <Text
            className={`text-2xl font-bold ${
              getMoodInterpretation(overallAvg).textClass
            }`}
          >
            {overallAvg.toFixed(1)}
          </Text>
          <Text className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1">
            All-time Avg
          </Text>
        </View>
        
        <View className="flex-1 bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
           <View className="w-8 h-8 bg-purple-50 dark:bg-purple-900/20 rounded-full items-center justify-center mb-2">
             <Ionicons name="layers" size={16} color="#a855f7" />
          </View>
          <Text className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {moods.length}
          </Text>
          <Text className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1">
            Total Entries
          </Text>
        </View>
      </View>

      {/* Mini Weekly Chart */}
      {recentWeeks.length > 0 && <MiniWeeklyChart weeklyData={recentWeeks} />}

      {/* Recent Week Summary */}
      <View className="mx-4 mb-6">
        <Text className="text-base font-bold mb-3 text-slate-800 dark:text-slate-200 px-1">
          History
        </Text>
        {recentWeeks.slice(0, 3).map((week, index) => {
          const interpretation = getMoodInterpretation(week.avg);
          const isFirst = index === 0;
          return (
            <View
              key={week.weekStart.toString()}
              className={`bg-white dark:bg-slate-900 p-4 mb-2 flex-row justify-between items-center border border-slate-100 dark:border-slate-800 ${isFirst ? 'rounded-t-2xl rounded-b-lg' : index === 2 ? 'rounded-t-lg rounded-b-2xl' : 'rounded-lg'}`}
            >
                <View className="flex-row items-center gap-3">
                    <View className={`w-2 h-10 rounded-full ${interpretation.bgClass.replace('bg-', 'bg-').replace('100', '400')}`} />
                    <View>
                        <Text className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {format(week.weekStart, "MMM dd")} -{" "}
                            {format(
                            endOfWeek(week.weekStart, { weekStartsOn: 1 }),
                            "MMM dd"
                            )}
                        </Text>
                        <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {week.moods.length} entries
                        </Text>
                    </View>
                </View>
                
                <View className="items-end">
                     <Text
                      className={`text-lg font-bold ${interpretation.textClass}`}
                    >
                      {week.avg.toFixed(1)}
                    </Text>
                    <Text className="text-xs text-slate-400 dark:text-slate-500">
                        Avg
                    </Text>
                </View>
            </View>
          );
        })}
      </View>

    </ScrollView>
  );
};
