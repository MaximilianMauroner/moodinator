import React from "react";
import { View, Text } from "react-native";
import { useColorScheme } from "@/hooks/useColorScheme";
import { colors } from "@/constants/colors";

interface HistoryListHeaderProps {
  moodCount: number;
}

/**
 * Header for the mood history list section.
 * Shows "Recent entries" title with count badge.
 */
export function HistoryListHeader({ moodCount }: HistoryListHeaderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View className="flex-row justify-between items-center mb-3 px-1">
      <Text
        className="font-semibold text-base"
        style={{ color: isDark ? colors.text.dark : colors.text.light }}
      >
        Recent entries
      </Text>
      {moodCount > 0 && (
        <View
          className="px-2.5 py-1 rounded-full"
          style={{ backgroundColor: isDark ? colors.primaryBg.dark : colors.primaryBg.light }}
        >
          <Text
            className="text-xs font-medium"
            style={{ color: isDark ? colors.positive.text.dark : colors.positive.text.light }}
          >
            {moodCount} total
          </Text>
        </View>
      )}
    </View>
  );
}

export default HistoryListHeader;
