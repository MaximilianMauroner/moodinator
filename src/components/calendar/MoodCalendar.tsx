import React, { useState, useCallback, useEffect, useMemo } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { useThemeColors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";
import { useCalendarData, type CalendarDayData } from "./useCalendarData";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarWeekHeader } from "./CalendarWeekHeader";
import { CalendarDay } from "./CalendarDay";
import { DayDetailModal } from "./DayDetailModal";
import { moodScale } from "@/constants/moodScale";
import { typography } from "@/constants/typography";
import type { MoodEntry } from "@db/types";

type MoodCalendarProps = {
  onAddEntry?: (date: Date) => void;
  onEditEntry?: (entry: MoodEntry) => void;
  onRefreshReady?: (refreshFn: (() => Promise<void>) | null) => void;
};

export function MoodCalendar({
  onAddEntry,
  onEditEntry,
  onRefreshReady,
}: MoodCalendarProps) {
  const { isDark, get } = useThemeColors();
  const {
    year,
    month,
    monthName,
    monthData,
    loading,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    isCurrentMonth,
    canGoNext,
    refresh,
  } = useCalendarData();

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<MoodEntry[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const today = new Date();
  const isThisMonth = year === today.getFullYear() && month === today.getMonth();
  const todayDay = isThisMonth ? today.getDate() : -1;
  const monthSummary = useMemo(() => {
    if (!monthData) return null;

    let totalEntries = 0;
    let totalMood = 0;
    let loggedDays = 0;
    let bestDay: number | null = null;
    let bestMood = Number.POSITIVE_INFINITY;
    let busiestDay: number | null = null;
    let busiestCount = 0;

    monthData.days.forEach((dayData, day) => {
      const entryCount = dayData.entries.length;
      if (entryCount === 0) return;

      loggedDays += 1;
      totalEntries += entryCount;
      totalMood += dayData.entries.reduce((sum, entry) => sum + entry.mood, 0);

      if (dayData.averageMood !== null && dayData.averageMood < bestMood) {
        bestMood = dayData.averageMood;
        bestDay = day;
      }

      if (entryCount > busiestCount) {
        busiestCount = entryCount;
        busiestDay = day;
      }
    });

    const averageMood = totalEntries > 0 ? Math.round((totalMood / totalEntries) * 10) / 10 : null;
    const averageMoodIndex =
      averageMood !== null
        ? Math.max(0, Math.min(10, Math.round(averageMood)))
        : null;
    const averageMoodInfo = averageMoodIndex !== null ? moodScale[averageMoodIndex] : null;

    return {
      totalEntries,
      loggedDays,
      averageMood,
      averageMoodInfo,
      bestDay,
      busiestDay,
      busiestCount,
      coverage: Math.round((loggedDays / monthData.daysInMonth) * 100),
    };
  }, [monthData]);

  // Swipe gesture for month navigation
  const swipeGesture = Gesture.Pan()
    .runOnJS(true)
    .maxPointers(1)
    .minDistance(16)
    .activeOffsetX([-24, 24])
    .failOffsetY([-14, 14])
    .onEnd((event) => {
      const horizontalDistance = Math.abs(event.translationX);
      const verticalDistance = Math.abs(event.translationY);

      if (horizontalDistance < 80 || horizontalDistance < verticalDistance) {
        return;
      }

      if (event.translationX > 0) {
        haptics.monthChange();
        goToPreviousMonth();
      } else if (event.translationX < -80 && canGoNext) {
        haptics.monthChange();
        goToNextMonth();
      }
    });

  const handleDayPress = useCallback(
    (day: number, data?: CalendarDayData) => {
      const date = new Date(year, month, day);
      setSelectedDate(date);
      setSelectedEntries(data?.entries ?? []);
      setShowDetailModal(true);
    },
    [year, month]
  );

  const handleDayLongPress = useCallback(
    (day: number) => {
      if (!onAddEntry) return;
      const date = new Date(year, month, day, 12, 0, 0);
      onAddEntry(date);
    },
    [year, month, onAddEntry]
  );

  const handleCloseModal = useCallback(() => {
    setShowDetailModal(false);
  }, []);

  const handleEditEntry = useCallback(
    (entry: MoodEntry) => {
      setShowDetailModal(false);
      onEditEntry?.(entry);
    },
    [onEditEntry]
  );

  useEffect(() => {
    onRefreshReady?.(refresh);
    return () => {
      onRefreshReady?.(null);
    };
  }, [onRefreshReady, refresh]);

  // Generate calendar grid
  const renderCalendarGrid = () => {
    if (!monthData) return null;

    const { days, daysInMonth, firstDayOfWeek } = monthData;
    const rows: React.ReactNode[] = [];
    let cells: React.ReactNode[] = [];

    // Add empty cells for days before the 1st
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(<View key={`empty-start-${i}`} className="flex-1" />);
    }

    // Add day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dayData = days.get(day);
      const isToday = day === todayDay;

      cells.push(
        <CalendarDay
          key={day}
          day={day}
          data={dayData}
          isToday={isToday}
          isCurrentMonth={isCurrentMonth}
          onPress={handleDayPress}
          onLongPress={onAddEntry ? handleDayLongPress : undefined}
        />
      );

      // Start new row after Saturday
      if ((firstDayOfWeek + day) % 7 === 0) {
        rows.push(
          <View key={`row-${rows.length}`} className="flex-row">
            {cells}
          </View>
        );
        cells = [];
      }
    }

    // Add remaining cells for last row
    if (cells.length > 0) {
      while (cells.length < 7) {
        cells.push(<View key={`empty-end-${cells.length}`} className="flex-1" />);
      }
      rows.push(
        <View key={`row-${rows.length}`} className="flex-row">
          {cells}
        </View>
      );
    }

    return rows;
  };

  return (
    <View
      className="rounded-3xl p-4"
      style={{
        backgroundColor: get("surface"),
        shadowColor: isDark ? "#000" : "#9D8660",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.25 : 0.08,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      <CalendarHeader
        monthName={monthName}
        year={year}
        onPrevious={goToPreviousMonth}
        onNext={goToNextMonth}
        onToday={goToToday}
        canGoNext={canGoNext}
        isCurrentMonth={isCurrentMonth}
      />

      <GestureDetector gesture={swipeGesture}>
        <View>
          <CalendarWeekHeader />

          {loading ? (
            <View className="items-center justify-center py-16">
              <ActivityIndicator size="small" color={get("primary")} />
            </View>
          ) : (
            <View className="gap-1">{renderCalendarGrid()}</View>
          )}
        </View>
      </GestureDetector>

      {!loading && monthSummary && (
        <View
          className="mt-4 pt-4"
          style={{
            borderTopWidth: 1,
            borderTopColor: get("border"),
          }}
        >
          <View className="flex-row items-start justify-between mb-3">
            <View className="flex-1 pr-3">
              <Text
                className="text-paper-800 dark:text-paper-200"
                style={[typography.bodyMd, { fontWeight: "700" }]}
              >
                Month at a glance
              </Text>
              <Text
                className="mt-1"
                style={[typography.bodySm, { color: get("textMuted") }]}
              >
                {monthSummary.totalEntries > 0
                  ? `${monthSummary.loggedDays} active days across ${monthData?.daysInMonth ?? 0} days. Lower scores are better.`
                  : "No entries logged for this month yet."}
              </Text>
            </View>

            {monthSummary.averageMood !== null && monthSummary.averageMoodInfo ? (
              <View
                className="px-3 py-2 rounded-2xl"
                style={{
                  backgroundColor: isDark
                    ? monthSummary.averageMoodInfo.bgHexDark
                    : monthSummary.averageMoodInfo.bgHex,
                }}
              >
                <Text
                  style={[
                    typography.bodySm,
                    {
                      color: isDark
                        ? monthSummary.averageMoodInfo.textHexDark
                        : monthSummary.averageMoodInfo.textHex,
                    },
                  ]}
                >
                  Average
                </Text>
                <Text
                  style={[
                    typography.bodyMd,
                    {
                      color: isDark
                        ? monthSummary.averageMoodInfo.textHexDark
                        : monthSummary.averageMoodInfo.textHex,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {monthSummary.averageMood.toFixed(1)}
                </Text>
              </View>
            ) : null}
          </View>

          <View className="flex-row gap-2">
            <View
              className="flex-1 rounded-2xl px-3 py-3"
              style={{ backgroundColor: get("surfaceElevated") }}
            >
              <Text style={[typography.bodySm, { color: get("textMuted") }]}>Logged days</Text>
              <Text
                className="mt-1 text-paper-800 dark:text-paper-200"
                style={[typography.bodyMd, { fontWeight: "700" }]}
              >
                {monthSummary.loggedDays}
              </Text>
              <Text style={[typography.bodySm, { color: get("textSubtle") }]}>
                {monthSummary.coverage}% coverage
              </Text>
            </View>

            <View
              className="flex-1 rounded-2xl px-3 py-3"
              style={{ backgroundColor: get("surfaceElevated") }}
            >
              <Text style={[typography.bodySm, { color: get("textMuted") }]}>Entries</Text>
              <Text
                className="mt-1 text-paper-800 dark:text-paper-200"
                style={[typography.bodyMd, { fontWeight: "700" }]}
              >
                {monthSummary.totalEntries}
              </Text>
              <Text style={[typography.bodySm, { color: get("textSubtle") }]}>
                {monthSummary.busiestCount > 0
                  ? `${monthSummary.busiestCount} on ${monthName.slice(0, 3)} ${monthSummary.busiestDay}`
                  : "No peak day yet"}
              </Text>
            </View>
          </View>

          <View
            className="mt-2 rounded-2xl px-3 py-3"
            style={{ backgroundColor: get("surfaceElevated") }}
          >
            <Text style={[typography.bodySm, { color: get("textMuted") }]}>Best day so far</Text>
            <View
              className="mt-1 flex-row items-center justify-between"
            >
              <Text
                className="text-paper-800 dark:text-paper-200"
                style={[typography.bodyMd, { fontWeight: "700" }]}
              >
                {monthSummary.bestDay ? `${monthName.slice(0, 3)} ${monthSummary.bestDay}` : "None"}
              </Text>
              <Text style={[typography.bodySm, { color: get("textSubtle") }]}>
                {monthSummary.averageMoodInfo?.label ?? "No mood average yet"}
              </Text>
            </View>
          </View>

          <Text
            className="mt-3"
            style={[typography.bodySm, { color: get("textSubtle") }]}
          >
            Tap any day to open entries. Days with multiple logs show a small dot.
          </Text>
        </View>
      )}

      {/* Day Detail Modal */}
      {selectedDate && (
        <DayDetailModal
          visible={showDetailModal}
          date={selectedDate}
          entries={selectedEntries}
          onClose={handleCloseModal}
          onEditEntry={handleEditEntry}
          canAddEntry={Boolean(onAddEntry)}
        />
      )}
    </View>
  );
}
