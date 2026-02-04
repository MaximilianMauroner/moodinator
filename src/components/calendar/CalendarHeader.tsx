import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";

type CalendarHeaderProps = {
  monthName: string;
  year: number;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  canGoNext: boolean;
  isCurrentMonth: boolean;
};

export function CalendarHeader({
  monthName,
  year,
  onPrevious,
  onNext,
  onToday,
  canGoNext,
  isCurrentMonth,
}: CalendarHeaderProps) {
  const { isDark, get } = useThemeColors();

  const handlePrevious = () => {
    haptics.monthChange();
    onPrevious();
  };

  const handleNext = () => {
    if (canGoNext) {
      haptics.monthChange();
      onNext();
    }
  };

  const handleToday = () => {
    if (!isCurrentMonth) {
      haptics.light();
      onToday();
    }
  };

  return (
    <View className="flex-row items-center justify-between mb-4">
      <Pressable
        onPress={handlePrevious}
        className="p-2 rounded-xl"
        style={{
          backgroundColor: isDark ? "rgba(42, 37, 32, 0.8)" : "rgba(245, 241, 232, 0.9)",
        }}
        accessibilityRole="button"
        accessibilityLabel="Previous month"
      >
        <Ionicons name="chevron-back" size={20} color={get("text")} />
      </Pressable>

      <Pressable
        onPress={handleToday}
        disabled={isCurrentMonth}
        className="flex-row items-center"
        accessibilityRole="button"
        accessibilityLabel={`${monthName} ${year}. ${isCurrentMonth ? "Current month" : "Tap to go to current month"}`}
      >
        <Text
          className="text-lg font-bold"
          style={{ color: get("text") }}
        >
          {monthName} {year}
        </Text>
        {!isCurrentMonth && (
          <View
            className="ml-2 px-2 py-0.5 rounded-md"
            style={{ backgroundColor: get("primaryBg") }}
          >
            <Text
              className="text-xs font-medium"
              style={{ color: get("primary") }}
            >
              Today
            </Text>
          </View>
        )}
      </Pressable>

      <Pressable
        onPress={handleNext}
        disabled={!canGoNext}
        className="p-2 rounded-xl"
        style={{
          backgroundColor: isDark ? "rgba(42, 37, 32, 0.8)" : "rgba(245, 241, 232, 0.9)",
          opacity: canGoNext ? 1 : 0.4,
        }}
        accessibilityRole="button"
        accessibilityLabel="Next month"
      >
        <Ionicons name="chevron-forward" size={20} color={get("text")} />
      </Pressable>
    </View>
  );
}
