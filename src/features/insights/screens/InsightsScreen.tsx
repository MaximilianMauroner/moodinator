import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { format } from "date-fns";

import { useInsightsData } from "../hooks/useInsightsData";
import { TimePeriodSelector } from "../components/TimePeriodSelector";
import { WeekNavigator } from "../components/WeekNavigator";
import { InsightCard } from "../components/InsightCard";
import { PatternCard } from "../components/PatternCard";
import { StreakBadge } from "../components/StreakBadge";
import { EntryDetailModal } from "../components/EntryDetailModal";
import type { MoodEntry } from "@db/types";

export function InsightsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [selectedEntry, setSelectedEntry] = useState<MoodEntry | null>(null);
  const [showAllEntries, setShowAllEntries] = useState(false);

  const {
    allMoods,
    periodMoods,
    loading,
    period,
    currentDate,
    setPeriod,
    goToPrevious,
    goToNext,
    goToToday,
    canGoNext,
    canGoPrevious,
    stats,
    patterns,
    streak,
    getMoodLabel,
    getMoodColor,
    refresh,
  } = useInsightsData();

  const [refreshing, setRefreshing] = React.useState(false);

  // Reset expanded state when period or date changes
  useEffect(() => {
    setShowAllEntries(false);
  }, [period, currentDate]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  if (loading && allMoods.length === 0) {
    return (
      <View
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: isDark ? "#1C1916" : "#FAF8F4" }}
      >
        <View
          className="p-8 rounded-3xl"
          style={{
            backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
            shadowColor: isDark ? "#000" : "#9D8660",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.3 : 0.1,
            shadowRadius: 24,
            elevation: 4,
          }}
        >
          <ActivityIndicator size="large" color={isDark ? "#A8C5A8" : "#5B8A5B"} />
          <Text
            className="mt-4 font-medium text-sm text-center"
            style={{ color: isDark ? "#BDA77D" : "#6B5C4A" }}
          >
            Loading insights...
          </Text>
        </View>
      </View>
    );
  }

  const hasData = allMoods.length > 0;
  const hasPeriodData = periodMoods.length > 0;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        className="flex-1"
        style={{ backgroundColor: isDark ? "#1C1916" : "#FAF8F4" }}
        edges={["top"]}
      >
        {/* Header */}
        <View
          className="px-6 py-5"
          style={{ backgroundColor: isDark ? "#1C1916" : "#FAF8F4" }}
        >
          <View className="flex-row justify-between items-end">
            <View>
              <Text
                className="text-xs font-medium mb-1"
                style={{ color: isDark ? "#A8C5A8" : "#5B8A5B" }}
              >
                Your wellness journey
              </Text>
              <Text
                className="text-2xl font-bold"
                style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
              >
                Insights
              </Text>
              <Text
                className="text-sm mt-0.5"
                style={{ color: isDark ? "#BDA77D" : "#6B5C4A" }}
              >
                {allMoods.length} entries tracked
              </Text>
            </View>
            <TouchableOpacity
              onPress={onRefresh}
              className="p-3 rounded-2xl"
              style={{
                backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
                shadowColor: isDark ? "#000" : "#9D8660",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.25 : 0.1,
                shadowRadius: 8,
                elevation: 2,
              }}
              accessibilityRole="button"
              accessibilityLabel="Refresh insights"
            >
              <Ionicons
                name="refresh"
                size={18}
                color={isDark ? "#A8C5A8" : "#5B8A5B"}
              />
            </TouchableOpacity>
          </View>
        </View>

        {!hasData ? (
          <View className="flex-1 justify-center items-center p-8">
            <View
              className="p-8 rounded-3xl items-center max-w-xs"
              style={{
                backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
                shadowColor: isDark ? "#000" : "#9D8660",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isDark ? 0.3 : 0.1,
                shadowRadius: 24,
                elevation: 4,
              }}
            >
              <View
                className="w-20 h-20 rounded-3xl items-center justify-center mb-5"
                style={{ backgroundColor: isDark ? "#2D3D2D" : "#E8EFE8" }}
              >
                <Text className="text-4xl">📊</Text>
              </View>
              <Text
                className="text-xl font-bold mb-2 text-center"
                style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
              >
                No Insights Yet
              </Text>
              <Text
                className="text-center text-sm leading-6"
                style={{ color: isDark ? "#BDA77D" : "#6B5C4A" }}
              >
                Start tracking your moods to discover patterns and understand your
                emotional well-being better.
              </Text>
            </View>
          </View>
        ) : (
          <>
            {/* Time Period Selector */}
            <TimePeriodSelector value={period} onChange={setPeriod} />

            {/* Week/Day Navigator */}
            <WeekNavigator
              currentDate={currentDate}
              period={period}
              onPrevious={goToPrevious}
              onNext={goToNext}
              onToday={goToToday}
              canGoNext={canGoNext}
              canGoPrevious={canGoPrevious}
            />

            <ScrollView
              className="flex-1"
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: Platform.OS === "ios" ? 100 : 24,
              }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={isDark ? "#A8C5A8" : "#5B8A5B"}
                />
              }
            >
              {hasPeriodData ? (
                <>
                  {/* Main Stats Row */}
                  <View className="flex-row gap-4 mb-4">
                    <View className="flex-1">
                      <InsightCard
                        icon="analytics"
                        title="Average Mood"
                        metric={stats.averageMood.toFixed(1)}
                        metricSuffix="/ 10"
                        interpretation={getMoodLabel(stats.averageMood)}
                        trend={
                          stats.moodChange !== 0
                            ? {
                                direction: stats.trendDirection,
                                value: Math.abs(stats.moodChange),
                              }
                            : undefined
                        }
                        metricColor={getMoodColor(stats.averageMood)}
                        compact
                      />
                    </View>
                    <View className="flex-1">
                      <InsightCard
                        icon="layers"
                        title="Entries"
                        metric={stats.entryCount}
                        interpretation={
                          period === "week"
                            ? "this week"
                            : period === "day"
                            ? "today"
                            : "total"
                        }
                        compact
                      />
                    </View>
                  </View>

                  {/* Energy & Most Common Mood */}
                  {(stats.energyAvg !== null || stats.mostCommonMood !== undefined) && (
                    <View className="flex-row gap-4 mb-4">
                      {stats.energyAvg !== null && (
                        <View className="flex-1">
                          <InsightCard
                            icon="flash"
                            title="Avg Energy"
                            metric={stats.energyAvg.toFixed(1)}
                            metricSuffix="/ 10"
                            compact
                          />
                        </View>
                      )}
                      <View className="flex-1">
                        <InsightCard
                          icon="heart"
                          title="Most Common"
                          metric={stats.mostCommonMood}
                          interpretation={getMoodLabel(stats.mostCommonMood)}
                          metricColor={getMoodColor(stats.mostCommonMood)}
                          compact
                        />
                      </View>
                    </View>
                  )}

                  {/* Streak Badge (always show for week/all view) */}
                  {period !== "day" && (
                    <View className="mb-4">
                      <StreakBadge current={streak.current} longest={streak.longest} />
                    </View>
                  )}

                  {/* Patterns (only for week/all view with enough data) */}
                  {patterns.length > 0 && (
                    <View className="mb-4">
                      <PatternCard patterns={patterns} />
                    </View>
                  )}

                  {/* Entries List */}
                  {periodMoods.length > 0 && (
                    <View
                      className="rounded-3xl bg-paper-50 dark:bg-paper-850 p-5"
                      style={{
                        shadowColor: isDark ? "#000" : "#9D8660",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: isDark ? 0.25 : 0.08,
                        shadowRadius: 12,
                        elevation: 3,
                      }}
                    >
                      <View className="flex-row items-center mb-4">
                        <View
                          className="w-10 h-10 rounded-2xl items-center justify-center mr-3"
                          style={{
                            backgroundColor: isDark ? "#2D3D2D" : "#E8EFE8",
                          }}
                        >
                          <Ionicons
                            name={period === "day" ? "time" : "list"}
                            size={20}
                            color={isDark ? "#A8C5A8" : "#5B8A5B"}
                          />
                        </View>
                        <Text className="text-base font-semibold text-paper-800 dark:text-paper-200">
                          {period === "day" ? "Today's Entries" : "Recent Entries"}
                        </Text>
                      </View>

                      {(showAllEntries ? periodMoods : periodMoods.slice(0, 5)).map((mood, index, arr) => (
                        <TouchableOpacity
                          key={mood.id}
                          onPress={() => setSelectedEntry(mood)}
                          activeOpacity={0.7}
                          className={`flex-row items-center py-3 ${
                            index < arr.length - 1
                              ? "border-b border-paper-200 dark:border-paper-800"
                              : ""
                          }`}
                        >
                          <View
                            className="w-10 h-10 rounded-2xl items-center justify-center mr-3"
                            style={{ backgroundColor: getMoodColor(mood.mood) + "20" }}
                          >
                            <Text
                              className="text-lg font-bold"
                              style={{ color: getMoodColor(mood.mood) }}
                            >
                              {mood.mood}
                            </Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-medium text-paper-800 dark:text-paper-200">
                              {getMoodLabel(mood.mood)}
                            </Text>
                            <Text className="text-xs text-sand-500 dark:text-sand-400">
                              {period === "day"
                                ? format(new Date(mood.timestamp), "h:mm a")
                                : format(new Date(mood.timestamp), "EEE, MMM d 'at' h:mm a")}
                            </Text>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={isDark ? "#6B5C4A" : "#BDA77D"}
                          />
                        </TouchableOpacity>
                      ))}

                      {periodMoods.length > 5 && (
                        <TouchableOpacity
                          onPress={() => setShowAllEntries(!showAllEntries)}
                          activeOpacity={0.7}
                          className="mt-3 py-2"
                        >
                          <Text
                            className="text-xs text-center font-medium"
                            style={{ color: isDark ? "#A8C5A8" : "#5B8A5B" }}
                          >
                            {showAllEntries
                              ? "Show less"
                              : `+${periodMoods.length - 5} more entries`}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </>
              ) : (
                /* No data for this period */
                <View
                  className="rounded-3xl bg-paper-50 dark:bg-paper-850 p-8 items-center"
                  style={{
                    shadowColor: isDark ? "#000" : "#9D8660",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: isDark ? 0.25 : 0.08,
                    shadowRadius: 12,
                    elevation: 3,
                  }}
                >
                  <View
                    className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
                    style={{ backgroundColor: isDark ? "#2A2520" : "#F5F1E8" }}
                  >
                    <Text className="text-3xl">📭</Text>
                  </View>
                  <Text className="text-base font-semibold text-paper-800 dark:text-paper-200 mb-2">
                    No entries yet
                  </Text>
                  <Text className="text-sm text-center text-sand-500 dark:text-sand-400">
                    {period === "day"
                      ? "You haven't logged any moods for this day."
                      : "No mood entries for this time period."}
                  </Text>
                </View>
              )}
            </ScrollView>
          </>
        )}
      </SafeAreaView>

      {/* Entry Detail Modal */}
      <EntryDetailModal
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        getMoodLabel={getMoodLabel}
        getMoodColor={getMoodColor}
      />
    </GestureHandlerRootView>
  );
}
