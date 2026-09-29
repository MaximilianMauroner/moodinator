import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";
import { getMoodRatingLabel } from "@/constants/moodScaleInterpretation";
import { getMoodWeatherColor, getMoodWeatherIcon } from "@/constants/moodWeather";
import type { CalendarDayData } from "./useCalendarData";

type CalendarDayProps = {
  day: number;
  data?: CalendarDayData;
  isToday: boolean;
  onPress: (day: number, data?: CalendarDayData) => void;
  onLongPress?: (day: number) => void;
};

export function CalendarDay({
  day,
  data,
  isToday,
  onPress,
  onLongPress,
}: CalendarDayProps) {
  const { isDark, get } = useThemeColors();

  const handlePress = () => {
    haptics.tick();
    onPress(day, data);
  };

  const handleLongPress = () => {
    if (!onLongPress) return;
    haptics.tap();
    onLongPress(day);
  };

  const hasMood = !!data && data.entries.length > 0;
  const weatherLevel =
    data?.averageMood !== null && data?.averageMood !== undefined
      ? Math.round(data.averageMood)
      : null;
  const backgroundColor = hasMood ? get("surface") : "transparent";

  const accessibilityHint = hasMood
    ? onLongPress
      ? "Tap to view entries. Long press to add entry"
      : "Tap to view entries"
    : onLongPress
    ? "Tap to view day details or long press to add entry"
    : "Tap to view day details";
  const moodSummary = data?.averageMood !== null && data?.averageMood !== undefined
    ? `, average Mood Rating ${data.averageMood.toFixed(1)} of 10, ${getMoodRatingLabel(data.averageMood)}`
    : "";

  return (
    <View style={{ flex: 1, alignItems: "center", paddingVertical: 2 }}>
      <Pressable
        onPress={handlePress}
        onLongPress={onLongPress ? handleLongPress : undefined}
        delayLongPress={400}
        style={({ pressed }) => ({
          width: 44,
          height: 46,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed
            ? isDark
              ? "rgba(91, 138, 91, 0.3)"
              : "rgba(91, 138, 91, 0.2)"
            : backgroundColor,
          borderWidth: isToday ? 2 : hasMood ? 1 : 0,
          borderColor: isToday ? get("primary") : get("borderSubtle"),
        })}
        accessibilityRole="button"
        accessibilityLabel={`Day ${day}${hasMood ? `, has ${data!.entries.length} mood entries${moodSummary}` : ", no mood entries"}`}
        accessibilityHint={accessibilityHint}
      >
        {weatherLevel !== null ? (
          <Ionicons
            name={getMoodWeatherIcon(weatherLevel)}
            size={18}
            color={getMoodWeatherColor(weatherLevel, isDark)}
          />
        ) : null}
        <Text
          className="text-xs font-semibold"
          style={{ color: hasMood ? get("text") : isToday ? get("primary") : get("textMuted") }}
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
            }}
          />
        )}
      </View>
    </View>
  );
}
