import React from "react";
import { View, Text } from "react-native";
import { useColorScheme } from "@/hooks/useColorScheme";

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
        style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
      >
        Recent entries
      </Text>
      {moodCount > 0 && (
        <View
          className="px-2.5 py-1 rounded-full"
          style={{ backgroundColor: isDark ? "#2D3D2D" : "#E8EFE8" }}
        >
          <Text
            className="text-xs font-medium"
            style={{ color: isDark ? "#A8C5A8" : "#5B8A5B" }}
          >
            {moodCount} total
          </Text>
        </View>
      )}
    </View>
  );
}

export default HistoryListHeader;
