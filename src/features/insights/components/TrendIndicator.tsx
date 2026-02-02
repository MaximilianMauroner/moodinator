import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";

export type TrendDirection = "up" | "down" | "stable";

interface TrendIndicatorProps {
  direction: TrendDirection;
  value?: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function TrendIndicator({
  direction,
  value,
  showLabel = false,
  size = "md",
}: TrendIndicatorProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const sizeConfig = {
    sm: { icon: 12, text: "text-xs", padding: "px-2 py-1" },
    md: { icon: 14, text: "text-sm", padding: "px-2.5 py-1" },
    lg: { icon: 16, text: "text-base", padding: "px-3 py-1.5" },
  };

  const config = sizeConfig[size];

  // For mood tracking: lower is better, so "up" in trend means mood worsened
  // We show green when improving (direction down = mood number decreasing)
  const getColors = () => {
    switch (direction) {
      case "up":
        // Mood worsening (higher number = worse)
        return {
          bg: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2",
          text: isDark ? "#FCA5A5" : "#DC2626",
          icon: "trending-up" as const,
          label: "Worsening",
        };
      case "down":
        // Mood improving (lower number = better)
        return {
          bg: isDark ? "rgba(34, 197, 94, 0.15)" : "#DCFCE7",
          text: isDark ? "#86EFAC" : "#16A34A",
          icon: "trending-down" as const,
          label: "Improving",
        };
      case "stable":
      default:
        return {
          bg: isDark ? "rgba(148, 163, 184, 0.15)" : "#F1F5F9",
          text: isDark ? "#94A3B8" : "#64748B",
          icon: "remove" as const,
          label: "Stable",
        };
    }
  };

  const colors = getColors();

  return (
    <View
      className={`flex-row items-center rounded-full ${config.padding}`}
      style={{ backgroundColor: colors.bg }}
    >
      <Ionicons name={colors.icon} size={config.icon} color={colors.text} />
      {(showLabel || value !== undefined) && (
        <Text
          className={`${config.text} font-semibold ml-1`}
          style={{ color: colors.text }}
        >
          {value !== undefined
            ? `${Math.abs(value).toFixed(1)}`
            : colors.label}
        </Text>
      )}
    </View>
  );
}

/**
 * Helper to determine trend direction from a numeric change
 * For mood tracking: negative change = improvement (direction "down")
 */
export function getTrendDirection(change: number, threshold = 0.1): TrendDirection {
  if (change < -threshold) return "down"; // Improving
  if (change > threshold) return "up"; // Worsening
  return "stable";
}
