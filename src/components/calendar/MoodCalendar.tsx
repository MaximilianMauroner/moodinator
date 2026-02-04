import React, { useState, useCallback } from "react";
import { View, ActivityIndicator } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { useThemeColors } from "@/constants/colors";
import { useCalendarData, type CalendarDayData } from "./useCalendarData";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarWeekHeader } from "./CalendarWeekHeader";
import { CalendarDay } from "./CalendarDay";
import { DayDetailModal } from "./DayDetailModal";
import type { MoodEntry } from "@db/types";

type MoodCalendarProps = {
  onAddEntry?: (date: Date) => void;
  onEditEntry?: (entry: MoodEntry) => void;
};

export function MoodCalendar({ onAddEntry, onEditEntry }: MoodCalendarProps) {
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
  } = useCalendarData();

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<MoodEntry[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const today = new Date();
  const isThisMonth = year === today.getFullYear() && month === today.getMonth();
  const todayDay = isThisMonth ? today.getDate() : -1;

  // Swipe gesture for month navigation
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-30, 30])
    .onEnd((event) => {
      if (event.translationX > 80) {
        goToPreviousMonth();
      } else if (event.translationX < -80 && canGoNext) {
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
      const date = new Date(year, month, day, 12, 0, 0);
      onAddEntry?.(date);
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
          isCurrentMonth
          onPress={handleDayPress}
          onLongPress={handleDayLongPress}
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

      {/* Day Detail Modal */}
      {selectedDate && (
        <DayDetailModal
          visible={showDetailModal}
          date={selectedDate}
          entries={selectedEntries}
          onClose={handleCloseModal}
          onEditEntry={handleEditEntry}
        />
      )}
    </View>
  );
}
