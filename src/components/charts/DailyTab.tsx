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
} from "date-fns";
import type { MoodEntry } from "@db/types";
import { Circle } from "react-native-svg";
import {
  processMoodDataForDailyChart,
  getBaseChartConfig,
  getColorFromTailwind,
  getMoodInterpretation,
  sampleDataPoints,
} from "./ChartComponents";
import { moodScale } from "@/constants/moodScale";
import type { MoodScale } from "@/types/mood";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Ionicons } from "@expo/vector-icons";

// Memoized component for individual day items
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
    const scheme = useColorScheme();
    const isDark = scheme === "dark";

    return (
      <View className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 mb-3 overflow-hidden shadow-sm">
        <TouchableOpacity
          onPress={onToggle}
          className="p-4 flex-row justify-between items-center active:bg-slate-50 dark:active:bg-slate-800/50"
          activeOpacity={0.9}
        >
          <View className="flex-1">
            <Text className="font-semibold text-slate-800 dark:text-slate-200 text-base">
              {format(day.date, "EEEE, MMM dd")}
            </Text>
            <Text className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {hasRealData
                ? `${day.moods!.length} entries`
                : "No entries"}
            </Text>
          </View>
          
          <View className="flex-row items-center gap-3">
            {hasRealData ? (
                <View className="items-end">
                    <Text className={`text-xl font-bold ${interpretation.textClass}`}>
                        {day.finalAvg.toFixed(1)}
                    </Text>
                    <View className={`px-2 py-0.5 rounded-full ${interpretation.bgClass}`}>
                        <Text className={`text-[10px] font-bold uppercase ${interpretation.textClass}`}>
                            {interpretation.text}
                        </Text>
                    </View>
                </View>
            ) : (
                 <Text className="text-xs text-slate-300 dark:text-slate-600 italic mr-2">No Data</Text>
            )}
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
              Timeline
            </Text>
            {dayMoodEntries.length > 0 ? (
              <View className="gap-3">
                {dayMoodEntries.map((entry, idx) => {
                  const entryMoodInfo = moodScale.find(
                    (m: MoodScale) => m.value === entry.mood
                  );
                  const isLast = idx === dayMoodEntries.length - 1;
                  
                  return (
                    <View key={entry.id} className="flex-row">
                        {/* Timeline visuals */}
                        <View className="items-center mr-3 w-6">
                             <View className={`w-2.5 h-2.5 rounded-full ${entryMoodInfo?.color ? entryMoodInfo.color.replace('text-', 'bg-') : 'bg-slate-400'}`} />
                             {!isLast && <View className="w-0.5 flex-1 bg-slate-200 dark:bg-slate-700 my-1" />}
                        </View>

                        <View className="flex-1 pb-1">
                            <View className="flex-row justify-between items-center">
                                <Text className={`text-sm font-bold ${entryMoodInfo?.color || 'text-slate-700'}`}>
                                    {entry.mood} - {entryMoodInfo?.label}
                                </Text>
                                <Text className="text-xs text-slate-400">
                                    {format(new Date(entry.timestamp), "HH:mm")}
                                </Text>
                            </View>
                            {entry.note && (
                                <Text className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-5">
                                    {entry.note}
                                </Text>
                            )}
                             {/* Tags if available? (Future improvement) */}
                        </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text className="text-sm text-slate-500 italic">
                No entries for this day.
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
    return processMoodDataForDailyChart(moods, 30); // Limit to last 30 days
  }, [moods]);

  const { dailyAggregates, labels } = processedData;

  const reversedAggregates = useMemo(
    () => [...dailyAggregates].reverse(),
    [dailyAggregates]
  );

  // Sample chart data if too many points
  const sampledAggregates = useMemo(() => {
    if (reversedAggregates.length <= 200) {
      return reversedAggregates;
    }
    // Sample to max 200 points for chart performance
    return sampleDataPoints(
      reversedAggregates.map(agg => ({ ...agg, timestamp: agg.date.getTime() })),
      200
    ).map(item => ({
      ...item,
      date: new Date(item.timestamp),
    }));
  }, [reversedAggregates]);

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

  const dotColors = useMemo(() => {
    return sampledAggregates.map((agg) => {
      const idx = Math.round(agg.finalAvg);
      return getColorFromTailwind(moodScale[idx]?.color);
    });
  }, [sampledAggregates]);

  const chartData = useMemo(
    () => ({
      labels: sampledAggregates.map((agg) => format(agg.date, "d")),
      datasets: [
        {
          data: sampledAggregates.map((agg) => agg.finalAvg),
          dotColor: dotColors,
          strokeWidth: 2,
          color: (o = 1) => `rgba(255,255,255,${o})`,
        },
        { data: [0], withDots: false },
        { data: [10], withDots: false },
      ],
    }),
    [sampledAggregates, dotColors]
  );

  return (
    <ScrollView
      className="flex-1 bg-transparent"
      contentContainerStyle={{ paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={onRefresh} />
      }
    >
      {/* Daily Chart */}
      <View className="mx-4 mb-6 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 overflow-hidden">
         <View className="flex-row justify-between items-center mb-4 px-2">
             <View>
                <Text className="text-lg font-bold text-slate-800 dark:text-slate-200">
                Daily Fluctuation
                </Text>
                <Text className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                Last 30 Days
                </Text>
            </View>
             <View className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-full items-center justify-center">
                 <Ionicons name="pulse" size={18} color="#3b82f6" />
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
              chartData.labels.length * 40
            )}
            height={220}
            chartConfig={getBaseChartConfig("#7986CB", "#5C6BC0", isDark)}
            style={{ borderRadius: 16 }}
            bezier
            segments={5}
            renderDotContent={({ x, y, index }) => {
              // Custom dot rendering logic remains
              const agg = sampledAggregates[index];
              if (!agg) return null;
              
              // Just render simple main dot to keep it clean, or keep complex logic if needed
              return (
                  <Circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="4"
                    fill={dotColors[index]}
                    stroke="#fff"
                    strokeWidth="1.5"
                  />
              );
            }}
          />
        </ScrollView>
      </View>

      {/* Recent Days List */}
      <View className="mx-4">
        <Text className="text-base font-bold mb-3 text-slate-800 dark:text-slate-200 px-1">
          Recent Days
        </Text>
        {recentDaysAggregates.map((day) => {
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
    </ScrollView>
  );
};
