import React from "react";
import { View, Text } from "react-native";
import { useColorScheme } from "@/hooks/useColorScheme";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { typography } from "@/constants/typography";

interface HomeHeaderProps {
  lastTracked: Date | null;
}

/**
 * Header component for the home screen.
 * Displays app title, subtitle, and last tracked time badge.
 */
export function HomeHeader({ lastTracked }: HomeHeaderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View className="-mx-4 mb-6">
      <ScreenHeader
        eyebrow="Daily check-in"
        title="Moodinator"
        subtitle="Track your emotional wellness"
        tone="sage"
        trailing={lastTracked ? (
          <View
            className="px-3 py-2 rounded-2xl"
            style={{
              backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
              borderWidth: 1,
              borderColor: isDark ? "#3D352A" : "#E5D9BF",
              shadowColor: isDark ? "#000" : "#9D8660",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.22 : 0.07,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <Text
              style={[
                typography.eyebrow,
                { color: isDark ? "#6B5C4A" : "#7A6B55", marginBottom: 2 },
              ]}
            >
              Last entry
            </Text>
            <Text
              className="text-sand-700 dark:text-sand-300"
              style={typography.bodyMd}
            >
              {lastTracked.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        ) : null}
      />
    </View>
  );
}

export default HomeHeader;
