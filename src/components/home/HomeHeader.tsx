import React from "react";
import { View, Text } from "react-native";
import { useColorScheme } from "@/hooks/useColorScheme";

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
    <View className="flex-row justify-between items-center mb-6">
      <View>
        <Text
          className="text-3xl font-bold"
          style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
        >
          Moodinator
        </Text>
        <Text
          className="text-sm mt-1"
          style={{ color: isDark ? "#BDA77D" : "#6B5C4A" }}
        >
          Track your emotional wellness
        </Text>
      </View>
      {lastTracked && (
        <View
          className="px-3 py-2 rounded-xl"
          style={{
            backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
            shadowColor: isDark ? "#000" : "#9D8660",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.25 : 0.08,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Text
            className="text-[10px] font-medium mb-0.5"
            style={{ color: isDark ? "#6B5C4A" : "#7A6B55" }}
          >
            Last entry
          </Text>
          <Text
            className="text-sm font-semibold"
            style={{ color: isDark ? "#D4C4A0" : "#5C4E3D" }}
          >
            {lastTracked.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      )}
    </View>
  );
}

export default HomeHeader;
