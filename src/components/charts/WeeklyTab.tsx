import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { format, endOfWeek, startOfWeek } from "date-fns";
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
import { Ionicons } from "@expo/vector-icons";

export const WeeklyTab = ({
  moods,
  onRefresh,
}: {
  moods: MoodEntry[];
  onRefresh: () => void;
}) => {
  const weeklyData = useMemo(() => processWeeklyMoodData(moods, 52), [moods]); // Limit to last 52 weeks
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  // Helper function to get mood entries for a specific week (memoized)
  const getMoodEntriesForWeek = useMemo(() => {
    // Pre-compute mood entries by week for faster lookups
    // Use same key format as processWeeklyMoodData: "yyyy-MM-dd"
    const moodsByWeek = new Map<string, MoodEntry[]>();
    moods.forEach((mood) => {
      const moodDate = new Date(mood.timestamp);
      const weekStart = startOfWeek(moodDate, { weekStartsOn: 1 });
      const weekKey = format(weekStart, "yyyy-MM-dd");
      if (!moodsByWeek.has(weekKey)) {
        moodsByWeek.set(weekKey, []);
      }
      moodsByWeek.get(weekKey)!.push(mood);
    });
    
    // Sort entries in each week
    moodsByWeek.forEach((entries) => {
      entries.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    });
    
    return (weekStart: Date): MoodEntry[] => {
      const weekKey = format(weekStart, "yyyy-MM-dd");
      return moodsByWeek.get(weekKey) || [];
    };
  }, [moods]);

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
        <Text className="text-slate-500 text-center text-lg font-medium">
          No weekly data available yet
        </Text>
      </View>
    );
  }

  const chartData = useMemo(() => {
    // Limit displayed weeks to last 52 for performance
    const displayWeeks = weeklyData.weeklyAggregates.slice(0, 52);
    return {
      labels: displayWeeks.map((week) => format(week.weekStart, "'W'w MMM")),
      datasets: [
        {
          data: displayWeeks.map((week) => week.avg),
          strokeWidth: 3,
          color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        },
        { data: [0], withDots: false }, // Min y
        { data: [10], withDots: false }, // Max y
      ],
    };
  }, [weeklyData]);

  return (
    <ScrollView
      className="flex-1 bg-transparent"
      contentContainerStyle={{ paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={onRefresh} />
      }
    >
      {/* Weekly Trend Chart */}
      <View className="mx-4 mb-6 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 overflow-hidden">
        <View className="flex-row justify-between items-center mb-4 px-2">
             <View>
                <Text className="text-lg font-bold text-slate-800 dark:text-slate-200">
                Weekly Trends
                </Text>
                <Text className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                Last {weeklyData.weeklyAggregates.length} weeks
                </Text>
            </View>
             <View className="w-8 h-8 bg-emerald-50 dark:bg-emerald-900/20 rounded-full items-center justify-center">
                 <Ionicons name="trending-up" size={18} color="#10b981" />
             </View>
        </View>
       
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingRight: 20 }}
        >
          <LineChart
            data={chartData}
            width={Math.max(
              Dimensions.get("window").width - 64,
              chartData.labels.length * 60
            )}
            height={220}
            chartConfig={getBaseChartConfig("#10B981", "#059669", isDark)}
            style={{ borderRadius: 16 }}
            bezier
            segments={5}
          />
        </ScrollView>
      </View>

      {/* Detailed Weekly Breakdown */}
      <View className="mx-4">
        <Text className="text-base font-bold mb-3 text-slate-800 dark:text-slate-200 px-1">
          Breakdown
        </Text>
        
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
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 mb-3 overflow-hidden shadow-sm"
            >
              <TouchableOpacity
                onPress={() => toggleWeekExpansion(weekKey)}
                className="p-4 flex-row justify-between items-center active:bg-slate-50 dark:active:bg-slate-800/50"
                activeOpacity={0.9}
              >
                <View className="flex-1">
                  <Text className="font-semibold text-slate-800 dark:text-slate-200 text-base">
                    {format(week.weekStart, "MMM dd")} -{" "}
                    {format(
                      endOfWeek(week.weekStart, { weekStartsOn: 1 }),
                      "MMM dd"
                    )}
                  </Text>
                  <View className="flex-row items-center mt-1">
                    <Text className="text-xs text-slate-500 dark:text-slate-400 mr-2">
                       {week.moods.length} entries
                    </Text>
                    {prevWeek && (
                        <Text className={`text-xs font-medium ${trendInterpretation.textClass}`}>
                            {trend < 0 ? "↓" : trend > 0 ? "↑" : "→"} {Math.abs(trend).toFixed(1)}
                        </Text>
                    )}
                  </View>
                </View>
                
                <View className="flex-row items-center gap-3">
                    <View className="items-end">
                        <Text className={`text-xl font-bold ${interpretation.textClass}`}>
                            {week.avg.toFixed(1)}
                        </Text>
                         <Text className={`text-xs font-medium ${interpretation.textClass}`}>
                            {interpretation.text}
                        </Text>
                    </View>
                    <Ionicons 
                        name={isExpanded ? "chevron-up" : "chevron-down"} 
                        size={20} 
                        color={isDark ? "#475569" : "#cbd5e1"} 
                    />
                </View>
              </TouchableOpacity>

              {/* Accordion Content */}
              {isExpanded && (
                <View className="bg-slate-50 dark:bg-slate-950/30 border-t border-slate-100 dark:border-slate-800 p-4">
                  <Text className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                    Entries
                  </Text>
                  
                  {weekMoodEntries.length > 0 ? (
                    <View className="gap-2">
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
                              className="flex-row items-start bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50"
                            >
                                <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${entryMoodInfo?.bg || 'bg-slate-100'}`}>
                                    <Text className={`font-bold ${entryMoodInfo?.color || 'text-slate-600'}`}>
                                        {entry.mood}
                                    </Text>
                                </View>
                                <View className="flex-1">
                                    <View className="flex-row justify-between items-center mb-0.5">
                                        <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                            {entryMoodInfo?.label}
                                        </Text>
                                        <Text className="text-xs text-slate-400">
                                            {format(new Date(entry.timestamp), "EEE, MMM d • HH:mm")}
                                        </Text>
                                    </View>
                                    {entry.note && (
                                        <Text className="text-sm text-slate-500 dark:text-slate-400 leading-5">
                                            {entry.note}
                                        </Text>
                                    )}
                                </View>
                            </View>
                          );
                        })}
                    </View>
                  ) : (
                    <Text className="text-sm text-slate-500 italic">
                      No details available.
                    </Text>
                  )}
                  
                  {/* Weekly Insight Stats */}
                  <View className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex-row justify-between">
                        <View>
                            <Text className="text-xs text-slate-400 mb-1">Range</Text>
                            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                {week.min} - {week.max}
                            </Text>
                        </View>
                        <View>
                            <Text className="text-xs text-slate-400 mb-1">Consistency</Text>
                            <Text className={`text-sm font-semibold ${week.moods.length >= 5 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {week.moods.length >= 5 ? 'High' : 'Low'}
                            </Text>
                        </View>
                        <View>
                            <Text className="text-xs text-slate-400 mb-1">Variability</Text>
                             <Text className={`text-sm font-semibold ${week.max - week.min <= 2 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {week.max - week.min <= 2 ? 'Stable' : 'Variable'}
                            </Text>
                        </View>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};
