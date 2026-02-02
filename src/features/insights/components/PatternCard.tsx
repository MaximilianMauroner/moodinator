import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import type { Pattern } from "../utils/patternDetection";

interface PatternCardProps {
  patterns: Pattern[];
}

function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Show 3 dots to indicate confidence level
  const dots = [0.33, 0.66, 1.0];

  return (
    <View className="flex-row items-center gap-1">
      {dots.map((threshold, index) => (
        <View
          key={index}
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor:
              confidence >= threshold
                ? isDark
                  ? "#A8C5A8"
                  : "#5B8A5B"
                : isDark
                ? "#3D352A"
                : "#E5D9BF",
          }}
        />
      ))}
    </View>
  );
}

function PatternItem({ pattern, isLast }: { pattern: Pattern; isLast: boolean }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Different icon backgrounds based on pattern type
  const getIconStyle = () => {
    switch (pattern.type) {
      case "time_of_day":
        return {
          bg: isDark ? "#2D3D2D" : "#E8EFE8",
          color: isDark ? "#A8C5A8" : "#5B8A5B",
        };
      case "day_of_week":
      case "weekend":
        return {
          bg: isDark ? "#302A22" : "#F9F5ED",
          color: isDark ? "#D4C4A0" : "#9D8660",
        };
      case "emotion":
        return {
          bg: isDark ? "#3D2822" : "#FDE8E4",
          color: isDark ? "#F5A899" : "#E06B55",
        };
      case "context":
        return {
          bg: isDark ? "#2D2A33" : "#EFECF2",
          color: isDark ? "#C4BBCF" : "#847596",
        };
      default:
        return {
          bg: isDark ? "#2D3D2D" : "#E8EFE8",
          color: isDark ? "#A8C5A8" : "#5B8A5B",
        };
    }
  };

  const iconStyle = getIconStyle();

  return (
    <View
      className={`flex-row items-start py-4 ${
        !isLast ? "border-b border-paper-200 dark:border-paper-800" : ""
      }`}
    >
      {/* Pattern icon */}
      <View
        className="w-11 h-11 rounded-2xl items-center justify-center mr-4"
        style={{ backgroundColor: iconStyle.bg }}
      >
        <Ionicons
          name={pattern.icon as keyof typeof Ionicons.glyphMap}
          size={20}
          color={iconStyle.color}
        />
      </View>

      {/* Pattern content */}
      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-1.5">
          <Text className="text-sm font-bold text-paper-800 dark:text-paper-200">
            {pattern.title}
          </Text>
          <ConfidenceIndicator confidence={pattern.confidence} />
        </View>
        <Text className="text-sm text-sand-500 dark:text-sand-400 leading-5">
          {pattern.description}
        </Text>
      </View>
    </View>
  );
}

export function PatternCard({ patterns }: PatternCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  if (patterns.length === 0) {
    return null;
  }

  return (
    <View
      className="rounded-3xl bg-paper-50 dark:bg-paper-850 overflow-hidden"
      style={isDark ? styles.cardShadowDark : styles.cardShadowLight}
    >
      {/* Decorative top accent with gradient effect */}
      <View
        style={{
          height: 3,
          backgroundColor: isDark ? "#847596" : "#A396B3",
          opacity: 0.7,
        }}
      />

      <View className="p-5">
        {/* Header */}
        <View className="flex-row items-center mb-2">
          <View
            className="w-11 h-11 rounded-2xl items-center justify-center mr-4"
            style={{
              backgroundColor: isDark ? "#2D2A33" : "#EFECF2",
            }}
          >
            <Text className="text-xl">💡</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-paper-800 dark:text-paper-200">
              Patterns Detected
            </Text>
            <Text className="text-xs text-sand-500 dark:text-sand-400 mt-0.5">
              Insights from your mood history
            </Text>
          </View>
          <View
            className="px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: isDark ? "#2D3D2D" : "#E8EFE8",
            }}
          >
            <Text
              className="text-xs font-bold"
              style={{ color: isDark ? "#A8C5A8" : "#5B8A5B" }}
            >
              {patterns.length}
            </Text>
          </View>
        </View>

        {/* Pattern list */}
        <View className="mt-2">
          {patterns.map((pattern, index) => (
            <PatternItem
              key={pattern.id}
              pattern={pattern}
              isLast={index === patterns.length - 1}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadowLight: {
    elevation: 4,
    shadowColor: "#9D8660",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  cardShadowDark: {
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
});
