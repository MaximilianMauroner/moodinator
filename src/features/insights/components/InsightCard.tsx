import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { TrendIndicator, TrendDirection } from "./TrendIndicator";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { IconBadge } from "@/components/ui/IconBadge";
import { typography } from "@/constants/typography";
import { useThemeColors } from "@/constants/colors";

type InsightCardSharedProps = {
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
  variant?: "default" | "accent" | "warm";
};

type InsightCardBaseProps = InsightCardSharedProps & {
  compact: boolean;
};

function InsightCardBase({
  icon,
  title,
  metric,
  metricSuffix,
  interpretation,
  trend,
  metricColor,
  compact,
  variant = "default",
}: InsightCardBaseProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { get } = useThemeColors();

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
          iconBg: isDark ? "#353126" : "#F9F5ED",
          iconColor: isDark ? "#D7CAA4" : "#7A6545",
          accentLine: isDark ? "#7F9564" : "#D4C4A0",
        };
      default:
        return {
          iconBg: isDark ? "#2D3D2D" : "#E8EFE8",
          iconColor: isDark ? "#A8C5A8" : "#5B8A5B",
          accentLine: isDark ? "#455643" : "#E5D9BF",
        };
    }
  };

  const variantStyles = getVariantStyles();
  const tone = variant === "warm" ? "sand" : variant === "accent" ? "sage" : "neutral";

  return (
    <SurfaceCard
      tone={tone}
      accentColor={variantStyles.accentLine}
      padding={compact ? 16 : 20}
      style={{ flex: 1 }}
    >
      <View>
        {/* Header with icon and title */}
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-row items-center flex-1">
            <IconBadge
              icon={icon}
              tone={variant === "warm" ? "sand" : variant === "accent" ? "sage" : "neutral"}
              size={compact ? "sm" : "md"}
              style={{ marginRight: 12 }}
            />
            <Text
              className={`text-paper-700 dark:text-paper-300 flex-1 ${
                compact ? "text-sm" : "text-base"
              }`}
              numberOfLines={1}
              style={compact ? typography.bodySm : typography.bodyMd}
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
            className="text-paper-800 dark:text-paper-100"
            style={{
              ...(compact ? typography.metricMd : typography.metricLg),
              color: metricColor || get("text"),
            }}
          >
            {metric}
          </Text>
          {metricSuffix && (
            <Text
              className="ml-1"
              style={[
                compact ? typography.bodySm : typography.bodyMd,
                { color: get("textSubtle") },
              ]}
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
              style={[
                compact ? typography.bodySm : typography.bodyMd,
                { color: get("textMuted") },
              ]}
            >
              {interpretation}
            </Text>
          </View>
        )}
      </View>
    </SurfaceCard>
  );
}

export type InsightCardProps = InsightCardSharedProps;

export function InsightCard(props: InsightCardProps) {
  return <InsightCardBase {...props} compact={false} />;
}

export function CompactInsightCard(props: InsightCardProps) {
  return <InsightCardBase {...props} compact={true} />;
}
