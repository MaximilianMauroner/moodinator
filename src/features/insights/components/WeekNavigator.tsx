import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { format, startOfWeek, endOfWeek, isThisWeek, isToday } from "date-fns";
import { TimePeriod } from "./TimePeriodSelector";

interface WeekNavigatorProps {
  currentDate: Date;
  period: TimePeriod;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  canGoNext?: boolean;
  canGoPrevious?: boolean;
}

export function WeekNavigator({
  currentDate,
  period,
  onPrevious,
  onNext,
  onToday,
  canGoNext = true,
  canGoPrevious = true,
}: WeekNavigatorProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const getDateLabel = () => {
    if (period === "day") {
      if (isToday(currentDate)) {
        return "Today";
      }
      return format(currentDate, "EEEE, MMM d");
    }

    if (period === "week") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

      if (isThisWeek(currentDate, { weekStartsOn: 1 })) {
        return "This Week";
      }

      return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
    }

    return "All Time";
  };

  const showNavigation = period !== "all";
  const showTodayButton =
    period === "day" ? !isToday(currentDate) : !isThisWeek(currentDate, { weekStartsOn: 1 });

  // For "All Time", show a centered decorative display
  if (!showNavigation) {
    return (
      <View className="mx-4 mb-4">
        <View
          className="flex-row items-center justify-center py-3 px-5 rounded-2xl"
          style={{
            backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
            ...styles.navContainerLight,
          }}
        >
          <Ionicons
            name="infinite-outline"
            size={18}
            color={isDark ? "#A8C5A8" : "#5B8A5B"}
            style={{ marginRight: 8 }}
          />
          <Text
            className="text-base font-bold text-paper-800 dark:text-paper-200"
            style={{ letterSpacing: -0.3 }}
          >
            {getDateLabel()}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="mx-4 mb-4">
      <View className="flex-row items-center justify-between">
        {/* Previous button */}
        <TouchableOpacity
          onPress={onPrevious}
          disabled={!canGoPrevious}
          className="w-11 h-11 rounded-2xl items-center justify-center"
          style={[
            {
              backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
              opacity: canGoPrevious ? 1 : 0.4,
            },
            isDark ? styles.navButtonDark : styles.navButtonLight,
          ]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Previous ${period}`}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={isDark ? "#A8C5A8" : "#5B8A5B"}
          />
        </TouchableOpacity>

        {/* Center date display */}
        <View className="flex-1 items-center mx-3">
          <View
            className="px-4 py-2 rounded-xl"
            style={{
              backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
            }}
          >
            <Text
              className="text-base font-bold text-paper-800 dark:text-paper-200 text-center"
              style={{ letterSpacing: -0.3 }}
              numberOfLines={1}
            >
              {getDateLabel()}
            </Text>
          </View>
        </View>

        {/* Right side controls */}
        <View className="flex-row items-center gap-2">
          {showTodayButton && (
            <TouchableOpacity
              onPress={onToday}
              className="px-3.5 py-2.5 rounded-xl"
              style={{
                backgroundColor: isDark ? "#2D3D2D" : "#E8EFE8",
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Go to today"
            >
              <Text
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: isDark ? "#A8C5A8" : "#5B8A5B" }}
              >
                Today
              </Text>
            </TouchableOpacity>
          )}

          {/* Next button */}
          <TouchableOpacity
            onPress={onNext}
            disabled={!canGoNext}
            className="w-11 h-11 rounded-2xl items-center justify-center"
            style={[
              {
                backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
                opacity: canGoNext ? 1 : 0.4,
              },
              isDark ? styles.navButtonDark : styles.navButtonLight,
            ]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Next ${period}`}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isDark ? "#A8C5A8" : "#5B8A5B"}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navContainerLight: {
    shadowColor: "#9D8660",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  navButtonLight: {
    shadowColor: "#9D8660",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  navButtonDark: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
});
