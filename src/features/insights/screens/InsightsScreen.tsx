import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Platform,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { format } from "date-fns";
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

import { useInsightsData } from "../hooks/useInsightsData";
import { TimePeriodSelector } from "../components/TimePeriodSelector";
import { WeekNavigator } from "../components/WeekNavigator";
import { InsightCard, CompactInsightCard } from "../components/InsightCard";
import { PatternCard } from "../components/PatternCard";
import { StreakBadge } from "../components/StreakBadge";
import { EntryDetailModal } from "../components/EntryDetailModal";
import { InsightsHeader } from "../components/InsightsHeader";
import { MoodCalendar } from "@/components/calendar";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { IconBadge } from "@/components/ui/IconBadge";
import { ScreenBackgroundAccent } from "@/components/layout/ScreenBackgroundAccent";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { typography } from "@/constants/typography";
import { motion } from "@/constants/motion";
import { haptics } from "@/lib/haptics";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import type { MoodEntry } from "@db/types";

type ViewMode = "calendar" | "charts";

const viewModes: { id: ViewMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "charts", label: "Charts", icon: "bar-chart" },
];

export function InsightsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [selectedEntry, setSelectedEntry] = useState<MoodEntry | null>(null);
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const calendarRefreshRef = useRef<(() => Promise<void>) | null>(null);

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

  // Reset expanded state when period or date changes
  useEffect(() => {
    setShowAllEntries(false);
  }, [period, currentDate]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    haptics.selection();
    setViewMode(mode);
  }, []);

  const handleCalendarRefreshReady = useCallback((refreshCalendar: (() => Promise<void>) | null) => {
    calendarRefreshRef.current = refreshCalendar;
  }, []);

  const handleCalendarEntryPress = useCallback((entry: MoodEntry) => {
    setSelectedEntry(entry);
  }, []);

  const handleRefreshAction = React.useCallback(async () => {
    await Promise.all([
      refresh(),
      calendarRefreshRef.current?.() ?? Promise.resolve(),
    ]);
  }, [refresh]);

  const { refreshing, onRefresh } = usePullToRefresh(handleRefreshAction);

  if (loading && allMoods.length === 0) {
    return (
      <View
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: isDark ? "#08150F" : "#FAF8F4" }}
      >
        <LoadingSpinner message="Loading insights..." />
      </View>
    );
  }

  const hasData = allMoods.length > 0;
  const hasPeriodData = periodMoods.length > 0;
  const reveal = (index: number) =>
    FadeInUp.duration(motion.duration.normal).delay(index * motion.stagger.tight);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        className="flex-1"
        style={{ backgroundColor: isDark ? "#08150F" : "#FAF8F4" }}
        edges={["top"]}
      >
        <ScreenBackgroundAccent />
        <InsightsHeader
          moods={allMoods}
          totalEntries={allMoods.length}
          onRefresh={onRefresh}
        />

        {/* View Mode Toggle */}
        {hasData && (
          <Animated.View entering={FadeIn.duration(motion.duration.normal)}>
            <SegmentedControl
              value={viewMode}
              items={viewModes}
              onChange={handleViewModeChange}
              variant="primary"
              padding={4}
            />
          </Animated.View>
        )}

        {!hasData ? (
          <EmptyState
            icon="bar-chart-outline"
            tone="sage"
            title="No Insights Yet"
            description="Start tracking your moods to discover patterns and understand your emotional well-being better."
          />
        ) : viewMode === "calendar" ? (
          <Animated.View
            key="calendar-view"
            entering={FadeIn.duration(motion.duration.normal)}
            exiting={FadeOut.duration(motion.duration.fast)}
            style={{ flex: 1 }}
          >
            <ScrollView
              className="flex-1 px-4"
              contentContainerStyle={{ paddingBottom: Platform.OS === "ios" ? 100 : 24 }}
              contentInsetAdjustmentBehavior="automatic"
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={isDark ? "#A6E39B" : "#5B8A5B"}
                />
              }
            >
              <MoodCalendar
                onRefreshReady={handleCalendarRefreshReady}
                onEditEntry={handleCalendarEntryPress}
              />
            </ScrollView>
          </Animated.View>
        ) : (
          <Animated.View
            key="charts-view"
            entering={FadeIn.duration(motion.duration.normal)}
            exiting={FadeOut.duration(motion.duration.fast)}
            style={{ flex: 1 }}
          >
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
              contentInsetAdjustmentBehavior="automatic"
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={isDark ? "#A6E39B" : "#5B8A5B"}
                />
              }
            >
              {hasPeriodData ? (
                <>
                  {/* Hero metric */}
                  <Animated.View entering={reveal(0)} className="mb-4">
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
                      variant="accent"
                    />
                  </Animated.View>

                  {/* Supporting metrics */}
                  <Animated.View entering={reveal(1)} className="flex-row gap-4 mb-4">
                    <View className="flex-1">
                      <CompactInsightCard
                        icon="layers"
                        title="Entries"
                        metric={stats.entryCount}
                        interpretation={
                          period === "week"
                            ? "this week"
                            : period === "month"
                            ? "this month"
                            : "total"
                        }
                        variant="warm"
                      />
                    </View>
                    <View className="flex-1">
                      <CompactInsightCard
                        icon="analytics"
                        title="Mood Range"
                        metric={
                          periodMoods.length > 0
                            ? `${Math.min(...periodMoods.map((m) => m.mood))}-${Math.max(...periodMoods.map((m) => m.mood))}`
                            : "-"
                        }
                        interpretation="spread"
                      />
                    </View>
                  </Animated.View>

                  {/* Energy & Most Common Mood */}
                  {(stats.energyAvg !== null || stats.mostCommonMood !== undefined) && (
                    <Animated.View entering={reveal(2)} className="flex-row gap-4 mb-4">
                      {stats.energyAvg !== null && (
                        <View className="flex-1">
                          <CompactInsightCard
                            icon="flash"
                            title="Avg Energy"
                            metric={stats.energyAvg.toFixed(1)}
                            metricSuffix="/ 10"
                            variant="warm"
                          />
                        </View>
                      )}
                      <View className="flex-1">
                        <CompactInsightCard
                          icon="heart"
                          title="Most Common"
                          metric={stats.mostCommonMood}
                          interpretation={getMoodLabel(stats.mostCommonMood)}
                          metricColor={getMoodColor(stats.mostCommonMood)}
                          variant="accent"
                        />
                      </View>
                    </Animated.View>
                  )}

                  {/* Streak Badge (always show for non-week snapshots) */}
                  {period !== "week" && (
                    <Animated.View entering={reveal(3)} className="mb-4">
                      <StreakBadge current={streak.current} longest={streak.longest} />
                    </Animated.View>
                  )}

                  {/* Patterns (only for month/all view with enough data) */}
                  {patterns.length > 0 && (
                    <Animated.View entering={reveal(4)} className="mb-4">
                      <PatternCard patterns={patterns} />
                    </Animated.View>
                  )}

                  {/* Entries List */}
                  {periodMoods.length > 0 && (
                    <Animated.View entering={reveal(5)}>
                    <SurfaceCard tone="sage" style={{ marginBottom: 4 }}>
                      <View className="flex-row items-center mb-4">
                        <IconBadge
                          icon={
                            period === "week"
                              ? "time-outline"
                              : period === "month"
                              ? "calendar-outline"
                              : "list-outline"
                          }
                          tone="sage"
                          size="md"
                          style={{ marginRight: 12 }}
                        />
                        <Text className="text-paper-800 dark:text-paper-200" style={typography.bodyMd}>
                          {period === "week"
                            ? "This Week's Entries"
                            : period === "month"
                            ? "This Month's Entries"
                            : "Recent Entries"}
                        </Text>
                      </View>

                      {(showAllEntries ? periodMoods : periodMoods.slice(0, 5)).map((mood, index, arr) => (
                        <Animated.View
                          key={mood.id}
                          entering={FadeInUp.duration(motion.duration.normal).delay(
                            Math.min(index, 6) * motion.stagger.tight
                          )}
                          layout={LinearTransition.duration(motion.duration.normal)}
                        >
                          <Pressable
                            onPress={() => setSelectedEntry(mood)}
                            style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
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
                              <Text className="text-paper-800 dark:text-paper-200" style={typography.bodyMd}>
                                {getMoodLabel(mood.mood)}
                              </Text>
                              <Text className="text-sand-500 dark:text-sand-400" style={typography.bodySm}>
                                {period === "week"
                                  ? format(new Date(mood.timestamp), "EEE 'at' h:mm a")
                                  : format(new Date(mood.timestamp), "EEE, MMM d 'at' h:mm a")}
                              </Text>
                            </View>
                            <Ionicons
                              name="chevron-forward"
                              size={16}
                              color={isDark ? "#9FB39A" : "#BDA77D"}
                            />
                          </Pressable>
                        </Animated.View>
                      ))}

                      {periodMoods.length > 5 && (
                        <Pressable
                          onPress={() => setShowAllEntries(!showAllEntries)}
                          style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
                          className="mt-3 py-2"
                        >
                          <Text
                            className="text-center"
                            style={[
                              typography.bodySm,
                              { color: isDark ? "#A8C5A8" : "#5B8A5B", fontWeight: "700" },
                            ]}
                          >
                            {showAllEntries
                              ? "Show less"
                              : `+${periodMoods.length - 5} more entries`}
                          </Text>
                        </Pressable>
                      )}
                    </SurfaceCard>
                    </Animated.View>
                  )}
                </>
              ) : (
                /* No data for this period */
                <EmptyState
                  icon="calendar-clear-outline"
                  tone="sand"
                  title="No entries yet"
                  description={
                    period === "week"
                      ? "You haven't logged any moods for this week."
                      : period === "month"
                      ? "You haven't logged any moods for this month."
                      : "No mood entries for this time period."
                  }
                />
              )}
            </ScrollView>
          </Animated.View>
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
