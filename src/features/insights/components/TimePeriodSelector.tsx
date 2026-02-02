import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";

export type TimePeriod = "week" | "day" | "all";

interface TimePeriodSelectorProps {
  value: TimePeriod;
  onChange: (period: TimePeriod) => void;
}

const periods: { id: TimePeriod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "week", label: "Week", icon: "calendar-outline" },
  { id: "day", label: "Day", icon: "today-outline" },
  { id: "all", label: "All", icon: "infinite-outline" },
];

export function TimePeriodSelector({ value, onChange }: TimePeriodSelectorProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View
      className="mx-4 mb-4 rounded-2xl p-1.5 flex-row"
      style={[
        {
          backgroundColor: isDark ? "#2A2520" : "#F5F1E8",
        },
        isDark ? styles.containerShadowDark : styles.containerShadowLight,
      ]}
    >
      {periods.map((period) => {
        const isActive = value === period.id;

        return (
          <TouchableOpacity
            key={period.id}
            onPress={() => onChange(period.id)}
            className="flex-1 flex-row items-center justify-center py-3 rounded-xl"
            style={
              isActive
                ? [
                    {
                      backgroundColor: isDark ? "#1C1916" : "#FDFCFA",
                    },
                    isDark ? styles.activeShadowDark : styles.activeShadowLight,
                  ]
                : {}
            }
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityLabel={`${period.label} view`}
            accessibilityState={{ selected: isActive }}
          >
            <Ionicons
              name={period.icon}
              size={16}
              color={
                isActive
                  ? isDark
                    ? "#A8C5A8"
                    : "#5B8A5B"
                  : isDark
                  ? "#6B5C4A"
                  : "#BDA77D"
              }
              style={{ marginRight: 6 }}
            />
            <Text
              className="text-sm font-semibold"
              style={{
                color: isActive
                  ? isDark
                    ? "#A8C5A8"
                    : "#5B8A5B"
                  : isDark
                  ? "#6B5C4A"
                  : "#BDA77D",
              }}
            >
              {period.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  containerShadowLight: {
    shadowColor: "#9D8660",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  containerShadowDark: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  activeShadowLight: {
    shadowColor: "#9D8660",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  activeShadowDark: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
});
