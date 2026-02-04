import React from "react";
import { View, Text, Pressable } from "react-native";
import { useThemeColors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";
import type { CalendarDayData } from "./useCalendarData";

type CalendarDayProps = {
  day: number;
  data?: CalendarDayData;
  isToday: boolean;
  isCurrentMonth: boolean;
  onPress: (day: number, data?: CalendarDayData) => void;
  onLongPress: (day: number) => void;
};

export function CalendarDay({
  day,
  data,
  isToday,
  isCurrentMonth,
  onPress,
  onLongPress,
}: CalendarDayProps) {
  const { isDark, get } = useThemeColors();

  const handlePress = () => {
    haptics.selection();
    onPress(day, data);
  };

  const handleLongPress = () => {
    haptics.longPressActivate();
    onLongPress(day);
  };

  const hasMood = !!data && data.entries.length > 0;
  const backgroundColor = hasMood
    ? isDark
      ? data.moodColorDark
      : data.moodColor
    : isDark
    ? "rgba(42, 37, 32, 0.5)"
    : "rgba(245, 241, 232, 0.6)";

  return (
    <View className="flex-1 items-center py-1">
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={400}
        className="items-center justify-center"
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: pressed
            ? isDark
              ? "rgba(91, 138, 91, 0.3)"
              : "rgba(91, 138, 91, 0.2)"
            : backgroundColor,
          borderWidth: isToday ? 2.5 : 0,
          borderColor: get("primary"),
          opacity: isCurrentMonth ? 1 : 0.4,
        })}
        accessibilityRole="button"
        accessibilityLabel={`Day ${day}${hasMood ? `, has ${data!.entries.length} mood entries` : ""}`}
        accessibilityHint={hasMood ? "Tap to view entries" : "Long press to add entry"}
      >
        <Text
          className="text-sm font-semibold"
          style={{
            color: isToday
              ? get("primary")
              : hasMood
              ? isDark
                ? "#F5F1E8"
                : "#3D352A"
              : get("textMuted"),
          }}
        >
          {day}
        </Text>

        {/* Multiple entries indicator dot */}
        {data?.hasMultiple && (
          <View
            className="absolute bottom-1"
            style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: isDark ? "#F5F1E8" : "#3D352A",
              opacity: 0.6,
            }}
          />
        )}
      </Pressable>
    </View>
  );
}
