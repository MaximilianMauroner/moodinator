import React from "react";
import { View, Text } from "react-native";
import { useColorScheme } from "@/hooks/useColorScheme";
import { colors } from "@/constants/colors";

interface HistoryListHeaderProps {
  title: string;
  moodCount: number;
  /** Badge text after the count, for example "total" or "today". */
  countSuffix: string;
  countTestID: string;
}

/**
 * Header for a list of mood entries: a title with a count badge.
 *
 * Carries no bottom margin: it shares a centred row with the filter button, and
 * a margin here would push the title off that row's centre line.
 */
export function HistoryListHeader({ title, moodCount, countSuffix, countTestID }: HistoryListHeaderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View className="flex-row justify-between items-center px-1">
      <Text
        className="font-semibold text-base"
        style={{ color: isDark ? colors.text.dark : colors.text.light }}
      >
        {title}
      </Text>
      {moodCount > 0 && (
        <View
          className="px-2.5 py-1 rounded-full"
          style={{ backgroundColor: isDark ? colors.primaryBg.dark : colors.primaryBg.light }}
        >
          <Text
            testID={countTestID}
            className="text-xs font-medium"
            style={{ color: isDark ? colors.positive.text.dark : colors.positive.text.light }}
          >
            {moodCount} {countSuffix}
          </Text>
        </View>
      )}
    </View>
  );
}

export default HistoryListHeader;
