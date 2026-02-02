import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { TrendIndicator, TrendDirection } from "./TrendIndicator";

interface InsightCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  metric: string | number;
  metricSuffix?: string;
  interpretation?: string;
  trend?: {
    direction: TrendDirection;
    value?: number;
  };
  metricColor?: string;
  compact?: boolean;
  variant?: "default" | "accent" | "warm";
}

export function InsightCard({
  icon,
  title,
  metric,
  metricSuffix,
  interpretation,
  trend,
  metricColor,
  compact = false,
  variant = "default",
}: InsightCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Variant-based styling for visual hierarchy
  const getVariantStyles = () => {
    switch (variant) {
      case "accent":
        return {
          iconBg: isDark ? "#2D3D2D" : "#E8EFE8",
          iconColor: isDark ? "#A8C5A8" : "#5B8A5B",
          accentLine: isDark ? "#5B8A5B" : "#7BA87B",
        };
      case "warm":
        return {
          iconBg: isDark ? "#302A22" : "#F9F5ED",
          iconColor: isDark ? "#D4C4A0" : "#9D8660",
          accentLine: isDark ? "#BDA77D" : "#D4C4A0",
        };
      default:
        return {
          iconBg: isDark ? "#2D3D2D" : "#E8EFE8",
          iconColor: isDark ? "#A8C5A8" : "#5B8A5B",
          accentLine: isDark ? "#3D352A" : "#E5D9BF",
        };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <View
      className={`rounded-3xl bg-paper-50 dark:bg-paper-850 overflow-hidden ${compact ? "" : ""}`}
      style={[isDark ? styles.cardShadowDark : styles.cardShadowLight, { flex: 1 }]}
    >
      {/* Subtle top accent line */}
      <View
        style={{
          height: 3,
          backgroundColor: variantStyles.accentLine,
          opacity: 0.6,
        }}
      />

      <View className={compact ? "p-4" : "p-5"}>
        {/* Header with icon and title */}
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-row items-center flex-1">
            <View
              className="w-10 h-10 rounded-2xl items-center justify-center mr-3"
              style={{
                backgroundColor: variantStyles.iconBg,
              }}
            >
              <Ionicons
                name={icon}
                size={20}
                color={variantStyles.iconColor}
              />
            </View>
            <Text
              className={`font-semibold text-paper-700 dark:text-paper-300 flex-1 ${
                compact ? "text-sm" : "text-base"
              }`}
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>
          {trend && (
            <TrendIndicator
              direction={trend.direction}
              value={trend.value}
              size={compact ? "sm" : "md"}
            />
          )}
        </View>

        {/* Large metric display */}
        <View className="flex-row items-baseline">
          <Text
            className={`font-extrabold tracking-tight ${compact ? "text-3xl" : "text-4xl"}`}
            style={{
              color: metricColor || (isDark ? "#F5F1E8" : "#3D352A"),
              letterSpacing: -1,
            }}
          >
            {metric}
          </Text>
          {metricSuffix && (
            <Text
              className={`font-medium ml-1 text-sand-500 dark:text-sand-400 ${
                compact ? "text-sm" : "text-base"
              }`}
            >
              {metricSuffix}
            </Text>
          )}
        </View>

        {/* Interpretation text */}
        {interpretation && (
          <View className="mt-2 flex-row items-center">
            <View
              className="w-1.5 h-1.5 rounded-full mr-2"
              style={{ backgroundColor: variantStyles.iconColor, opacity: 0.7 }}
            />
            <Text
              className={`text-sand-500 dark:text-sand-400 leading-5 ${
                compact ? "text-xs" : "text-sm"
              }`}
            >
              {interpretation}
            </Text>
          </View>
        )}
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
