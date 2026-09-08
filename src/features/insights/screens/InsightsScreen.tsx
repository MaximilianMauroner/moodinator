import React, { useCallback, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useInsightsData } from "../hooks/useInsightsData";
import { InsightCard, CompactInsightCard } from "../components/InsightCard";
import { StreakBadge } from "../components/StreakBadge";
import { EntryDetailModal } from "../components/EntryDetailModal";
import { InsightsHeader } from "../components/InsightsHeader";
import { FindingCard } from "../components/FindingCard";
import { TrendBand } from "../components/TrendBand";
import { RhythmGrid } from "../components/RhythmGrid";
import { DriverRow } from "../components/DriverRow";
import { calculatePeriodStats } from "../utils/periodStats";
import type { AnalysisRange } from "../utils/analysis";
import { MoodCalendar } from "@/components/calendar";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { ScreenBackgroundAccent } from "@/components/layout/ScreenBackgroundAccent";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useThemeColors } from "@/constants/colors";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import type { MoodEntry } from "@db/types";

type ViewMode = "findings" | "charts" | "calendar";
const viewModes: {
  id: ViewMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "findings", label: "Findings", icon: "bulb-outline" },
  { id: "charts", label: "Charts", icon: "analytics" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
];
const ranges: { id: AnalysisRange; label: string }[] = [
  { id: "7", label: "7" },
  { id: "30", label: "30" },
  { id: "90", label: "90" },
  { id: "all", label: "All" },
];
function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <SurfaceCard tone="sage" style={{ marginBottom: 12 }}>
      <Text className="mb-3 text-base font-semibold text-paper-800 dark:text-paper-200">
        {title}
      </Text>
      {children}
    </SurfaceCard>
  );
}
export function InsightsScreen() {
  const { get } = useThemeColors();
  const [selectedEntry, setSelectedEntry] = useState<MoodEntry | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("findings");
  const calendarRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const {
    recentMoods,
    totalCount,
    loading,
    error,
    streak,
    getMoodLabel,
    getMoodColor,
    refresh,
    analysis,
    analysisRange,
    setAnalysisRange,
    analysisMoods,
  } = useInsightsData();
  const handleCalendarRefreshReady = useCallback(
    (callback: (() => Promise<void>) | null) => {
      calendarRefreshRef.current = callback;
    },
    [],
  );
  const handleRefresh = useCallback(async () => {
    await Promise.all([refresh(), calendarRefreshRef.current?.()]);
  }, [refresh]);
  const { refreshing, onRefresh } = usePullToRefresh(handleRefresh);
  const stats = calculatePeriodStats(analysisMoods, []);
  const dailyValues = analysis.dailySeries.filter(
    (point) => point.min !== null,
  );
  const best = dailyValues.reduce(
    (value, point) => Math.min(value, point.min!),
    Infinity,
  );
  const worst = dailyValues.reduce(
    (value, point) => Math.max(value, point.max!),
    -Infinity,
  );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        className="flex-1"
        style={{ backgroundColor: get("background") }}
        edges={["top"]}
      >
        <ScreenBackgroundAccent />
        <InsightsHeader
          moods={recentMoods}
          totalEntries={totalCount}
          onRefresh={onRefresh}
        />
        <SegmentedControl
          value={viewMode}
          items={viewModes}
          onChange={setViewMode}
          variant="primary"
          padding={4}
        />
        {viewMode !== "calendar" && (
          <>
            <View className="mx-4 mb-3 flex-row gap-2">
              {ranges.map((range) => (
                <Pressable
                  key={range.id}
                  onPress={() => setAnalysisRange(range.id)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    range.id === "all" ? "All history" : `Last ${range.id} days`
                  }
                  accessibilityState={{ selected: analysisRange === range.id }}
                  className="flex-1 rounded-xl px-2 py-3"
                  style={{
                    minHeight: 44,
                    backgroundColor: get(
                      analysisRange === range.id ? "primaryBg" : "surfaceAlt",
                    ),
                  }}
                >
                  <Text className="text-center font-semibold text-paper-800 dark:text-paper-200">
                    {range.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="px-4 mb-3 text-sm text-paper-700 dark:text-sand-300">
              {analysisRange === "all"
                ? "All history"
                : `Last ${analysisRange} days`}{" "}
              · {analysisMoods.length} entries
            </Text>
          </>
        )}
        {loading && viewMode !== "calendar" ? (
          <LoadingSpinner message="Loading insights..." />
        ) : error && analysisMoods.length === 0 ? (
          <EmptyState
            icon="warning-outline"
            tone="coral"
            title="Insights could not load"
            description={error}
            actionLabel="Try Again"
            onAction={() => void refresh()}
          />
        ) : (
          <ScrollView
            className="flex-1 px-4"
            contentContainerStyle={{
              paddingBottom: Platform.OS === "ios" ? 100 : 24,
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={get("text")}
              />
            }
          >
            {error && (
              <Text
                accessibilityRole="alert"
                className="mb-3 text-paper-700 dark:text-sand-300"
              >
                Showing saved insights. Refresh failed.
              </Text>
            )}
            {viewMode === "calendar" ? (
              <MoodCalendar
                onRefreshReady={handleCalendarRefreshReady}
                onEditEntry={setSelectedEntry}
              />
            ) : viewMode === "findings" ? (
              <>
                {analysis.findings.map((finding) => (
                  <FindingCard key={finding.id} finding={finding} />
                ))}
                <Text className="mb-4 text-xs text-paper-700 dark:text-sand-300">
                  These are associations in your entries, not explanations.
                  Logging habits and other circumstances can affect the
                  patterns.
                </Text>
              </>
            ) : (
              <>
                <ChartCard title="Trend">
                  <TrendBand series={analysis.dailySeries} />
                </ChartCard>
                <ChartCard title="Rhythm">
                  <RhythmGrid cells={analysis.rhythm} />
                </ChartCard>
                <ChartCard title="Drivers">
                  <Text className="text-xs text-paper-700 dark:text-sand-300">
                    Mean with above · mean without below. Lower is better.
                  </Text>
                  {analysis.drivers.length ? (
                    analysis.drivers.map((driver) => (
                      <DriverRow key={driver.id} driver={driver} />
                    ))
                  ) : (
                    <Text className="mt-3 text-sm text-paper-700 dark:text-sand-300">
                      A comparison needs 5 entries with a tag or emotion and 5
                      without it.
                    </Text>
                  )}
                </ChartCard>
                {stats.entryCount > 0 && (
                  <>
                    <View className="mb-3">
                      <InsightCard
                        icon="analytics"
                        title="Average Mood"
                        metric={stats.averageMood.toFixed(1)}
                        animateMetric={false}
                        metricSuffix="/ 10"
                        interpretation={`${getMoodLabel(stats.averageMood)}. Lower is better.`}
                        metricColor={getMoodColor(stats.averageMood)}
                        variant="accent"
                      />
                    </View>
                    <View className="flex-row gap-3 mb-3">
                      <View className="flex-1">
                        <CompactInsightCard
                          icon="layers"
                          title="Entries"
                          metric={stats.entryCount}
                          animateMetric={false}
                        />
                      </View>
                      <View className="flex-1">
                        <CompactInsightCard
                          icon="analytics"
                          title="Mood Range"
                          metric={`${best}–${worst}`}
                          animateMetric={false}
                          interpretation="best to most difficult"
                        />
                      </View>
                    </View>
                    <View className="flex-row gap-3 mb-3">
                      {stats.energyAvg !== null && (
                        <View className="flex-1">
                          <CompactInsightCard
                            icon="flash"
                            title="Avg Energy"
                            metric={stats.energyAvg.toFixed(1)}
                            animateMetric={false}
                            metricSuffix="/ 10"
                          />
                        </View>
                      )}
                      <View className="flex-1">
                        <CompactInsightCard
                          icon="heart"
                          title="Most Common"
                          metric={stats.mostCommonMood}
                          animateMetric={false}
                          interpretation={getMoodLabel(stats.mostCommonMood)}
                          metricColor={getMoodColor(stats.mostCommonMood)}
                        />
                      </View>
                    </View>
                  </>
                )}
                <StreakBadge
                  current={streak.current}
                  longest={streak.longest}
                />
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
      <EntryDetailModal
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        getMoodLabel={getMoodLabel}
        getMoodColor={getMoodColor}
      />
    </GestureHandlerRootView>
  );
}
