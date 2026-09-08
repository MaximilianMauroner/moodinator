import React from "react";
import { Text, View } from "react-native";
import { useThemeColors } from "@/constants/colors";
import {
  DAYPARTS,
  WEEKDAYS,
  rhythmCellColor,
  type RhythmCell,
} from "../utils/rhythm";
export function RhythmGrid({ cells }: { cells: RhythmCell[] }) {
  const { isDark } = useThemeColors();
  return (
    <View>
      <View className="flex-row gap-1">
        <View className="w-16" />
        {WEEKDAYS.map((day) => (
          <Text
            key={day}
            className="flex-1 text-center text-xs text-paper-700 dark:text-sand-300"
          >
            {day.slice(0, 1)}
          </Text>
        ))}
      </View>
      {DAYPARTS.map((part, row) => (
        <View key={part} className="flex-row items-center gap-1 mt-2">
          <Text className="w-16 text-xs text-paper-700 dark:text-sand-300">
            {part}
          </Text>
          {cells
            .filter((cell) => cell.daypart === row)
            .map((cell) => (
              <View
                key={cell.weekday}
                accessible
                accessibilityLabel={`${WEEKDAYS[cell.weekday]} ${part}, ${cell.mean === null ? "no entries" : `average ${cell.mean.toFixed(1)}, ${cell.count} entries`}`}
                className="flex-1 h-8 rounded-md"
                style={{ backgroundColor: rhythmCellColor(cell, isDark) }}
              />
            ))}
        </View>
      ))}
      <Text className="mt-3 text-xs text-paper-700 dark:text-sand-300">
        Mean mood · lower is better. Neutral cells have no entries.
      </Text>
      <Text className="mt-1 text-xs text-paper-700 dark:text-sand-300">
        Morning before 12 · Midday 12–17 · Evening 17–22 · Night 22–24
      </Text>
    </View>
  );
}
