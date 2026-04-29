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
  onLongPress?: (day: number) => void;
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
    if (!onLongPress) return;
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

  const accessibilityHint = hasMood
    ? onLongPress
      ? "Tap to view entries. Long press to add entry"
      : "Tap to view entries"
    : onLongPress
    ? "Tap to view day details or long press to add entry"
    : "Tap to view day details";

  return (
    <View style={{ flex: 1, alignItems: "center", paddingVertical: 2 }}>
      <Pressable
        onPress={handlePress}
        onLongPress={onLongPress ? handleLongPress : undefined}
        delayLongPress={400}
        style={({ pressed }) => ({
          width: 44,
          height: 40,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
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
        accessibilityHint={accessibilityHint}
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
      </Pressable>

      {/* Multiple entries indicator — outside the cell so it never overlaps the number */}
      <View style={{ height: 7, justifyContent: "center", alignItems: "center" }}>
        {data?.hasMultiple && (
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: get("primary"),
              opacity: isCurrentMonth ? 1 : 0.4,
            }}
          />
        )}
      </View>
    </View>
  );
}
