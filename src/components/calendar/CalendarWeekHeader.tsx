import React from "react";
import { View, Text } from "react-native";
import { useThemeColors } from "@/constants/colors";

const WEEK_DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function CalendarWeekHeader() {
  const { get } = useThemeColors();

  return (
    <View className="flex-row mb-2">
      {WEEK_DAYS.map((day, index) => (
        <View key={index} className="flex-1 items-center py-2">
          <Text
            className="text-xs font-semibold"
            style={{ color: get("textMuted") }}
          >
            {day}
          </Text>
        </View>
      ))}
    </View>
  );
}
