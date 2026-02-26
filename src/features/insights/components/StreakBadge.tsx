import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { IconBadge } from "@/components/ui/IconBadge";
import { typography } from "@/constants/typography";

type StreakBadgeSharedProps = {
  current: number;
  longest: number;
};

type StreakBadgeBaseProps = StreakBadgeSharedProps & {
  compact: boolean;
};

function StreakBadgeBase({ current, longest, compact }: StreakBadgeBaseProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const isOnStreak = current > 0;
  const isNewRecord = current > 0 && current === longest;
  const progressPercent = longest > 0 ? Math.min((current / longest) * 100, 100) : 0;

  // Flame colors for active streak
  const flameColors = {
    primary: isDark ? "#FCD34D" : "#F59E0B",
    secondary: isDark ? "#FB923C" : "#EA580C",
    glow: isDark ? "rgba(252, 211, 77, 0.3)" : "rgba(245, 158, 11, 0.2)",
  };

  // Muted colors for inactive
  const inactiveColors = {
    primary: isDark ? "#6B5C4A" : "#9D8660",
    secondary: isDark ? "#4A4035" : "#BDA77D",
  };

  if (compact) {
    return (
      <SurfaceCard
        tone={isOnStreak ? "sand" : "neutral"}
        padding={12}
        style={{
          backgroundColor: isOnStreak
            ? isDark
              ? "rgba(245, 158, 11, 0.15)"
              : "#FEF3C7"
            : isDark
            ? "#2A2520"
            : "#F5F1E8",
        }}
      >
        <View className="flex-row items-center">
          <IconBadge
            icon={isOnStreak ? "flame-outline" : "moon-outline"}
            tone={isOnStreak ? "sand" : "neutral"}
            size="sm"
            style={{ marginRight: 8 }}
          />
          <Text
            style={{
              ...typography.bodyMd,
              fontWeight: "700",
              color: isOnStreak ? flameColors.primary : inactiveColors.primary,
            }}
          >
            {current} {current === 1 ? "day" : "days"}
          </Text>
        </View>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard
      tone="sand"
      accentColor={isOnStreak ? flameColors.primary : inactiveColors.secondary}
      accentHeight={4}
    >
      <View>
        {/* Main streak display */}
        <View className="flex-row items-start justify-between">
          <View className="flex-row items-center">
            {/* Animated flame container */}
            <View
              className="w-14 h-14 rounded-2xl items-center justify-center mr-4"
              style={{
                backgroundColor: isOnStreak
                  ? isDark
                    ? "rgba(245, 158, 11, 0.2)"
                    : "#FEF3C7"
                  : isDark
                  ? "#2A2520"
                  : "#F5F1E8",
              }}
            >
              {isOnStreak && (
                <View
                  style={{
                    position: "absolute",
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: flameColors.glow,
                  }}
                />
              )}
              <Ionicons
                name={isOnStreak ? "flame" : "moon-outline"}
                size={28}
                color={isOnStreak ? flameColors.secondary : inactiveColors.primary}
              />
            </View>

            <View>
              <Text className="text-sand-500 dark:text-sand-400 mb-1" style={typography.eyebrow}>
                Current Streak
              </Text>
              <View className="flex-row items-baseline">
                <Text
                  className="text-paper-800 dark:text-paper-100"
                  style={{
                    ...typography.metricLg,
                    color: isOnStreak ? flameColors.primary : inactiveColors.primary,
                  }}
                >
                  {current}
                </Text>
                <Text className="ml-2 text-sand-500 dark:text-sand-400" style={typography.bodyMd}>
                  {current === 1 ? "day" : "days"}
                </Text>
              </View>
            </View>
          </View>

          {/* New record badge */}
          {isNewRecord && current > 1 && (
            <View
              className="px-3 py-1.5 rounded-full"
              style={{
                backgroundColor: isDark ? "rgba(34, 197, 94, 0.2)" : "#DCFCE7",
                borderWidth: 1,
                borderColor: isDark ? "rgba(134, 239, 172, 0.3)" : "#BBF7D0",
              }}
            >
              <Text
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: isDark ? "#86EFAC" : "#16A34A" }}
              >
                Record!
              </Text>
            </View>
          )}
        </View>

        {/* Progress bar to longest streak */}
        {longest > 0 && !isNewRecord && (
          <View className="mt-5">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-xs font-medium text-sand-500 dark:text-sand-400">
                Progress to personal best
              </Text>
              <Text className="text-xs font-bold text-sand-600 dark:text-sand-300">
                {longest} days
              </Text>
            </View>
            <View
              className="h-3 rounded-full overflow-hidden"
              style={{ backgroundColor: isDark ? "#3D352A" : "#E5D9BF" }}
            >
              <View
                className="h-full rounded-full"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: isOnStreak ? flameColors.primary : inactiveColors.primary,
                }}
              />
            </View>
          </View>
        )}

        {/* Stats row */}
        <View
          className="flex-row mt-5 pt-4"
          style={{
            borderTopWidth: 1,
            borderTopColor: isDark ? "#3D352A" : "#E5D9BF",
          }}
        >
          <View className="flex-1 items-center">
            <IconBadge icon="trophy-outline" tone="sand" size="sm" style={{ marginBottom: 8 }} />
            <Text className="text-xs text-sand-500 dark:text-sand-400 mb-0.5">
              Personal Best
            </Text>
            <Text className="text-lg font-bold text-paper-700 dark:text-paper-300">
              {longest} {longest === 1 ? "day" : "days"}
            </Text>
          </View>

          <View
            className="w-px mx-4"
            style={{ backgroundColor: isDark ? "#3D352A" : "#E5D9BF" }}
          />

          <View className="flex-1 items-center">
            <IconBadge
              icon={isOnStreak ? "checkmark" : "remove"}
              tone={isOnStreak ? "sage" : "coral"}
              size="sm"
              style={{ marginBottom: 8 }}
            />
            <Text className="text-xs text-sand-500 dark:text-sand-400 mb-0.5">
              Status
            </Text>
            <Text
              className="text-lg font-bold"
              style={{
                color: isOnStreak
                  ? isDark
                    ? "#86EFAC"
                    : "#16A34A"
                  : isDark
                  ? "#FCA5A5"
                  : "#DC2626",
              }}
            >
              {isOnStreak ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>
      </View>
    </SurfaceCard>
  );
}

export type StreakBadgeProps = StreakBadgeSharedProps;

export function StreakBadge(props: StreakBadgeProps) {
  return <StreakBadgeBase {...props} compact={false} />;
}

export function CompactStreakBadge(props: StreakBadgeProps) {
  return <StreakBadgeBase {...props} compact={true} />;
}
