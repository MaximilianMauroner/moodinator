import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { IconBadge } from "@/components/ui/IconBadge";
import { typography } from "@/constants/typography";
import { motion } from "@/constants/motion";
import { semanticToneColors } from "@/constants/colors";
import { useCountUp } from "@/hooks/useCountUp";
import { useReducedMotion } from "@/hooks/useReducedMotion";

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
  const reducedMotion = useReducedMotion();
  const mode = isDark ? "dark" : "light";

  const isOnStreak = current > 0;
  const isNewRecord = current > 0 && current === longest;
  const progressPercent = longest > 0 ? Math.min((current / longest) * 100, 100) : 0;

  const countedCurrent = useCountUp(current);
  const progressWidth = useSharedValue(progressPercent);

  useEffect(() => {
    progressWidth.value = reducedMotion
      ? progressPercent
      : withTiming(progressPercent, {
          duration: motion.duration.reveal,
          easing: Easing.out(Easing.cubic),
        });
  }, [progressPercent, progressWidth, reducedMotion]);

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  // A streak is a warm, sand-family idea. An idle streak stays neutral rather
  // than reading as a failure, so a missed day never renders as an alarm.
  const sand = semanticToneColors.sand[mode];
  const sage = semanticToneColors.sage[mode];
  const neutral = semanticToneColors.neutral[mode];
  const tone = isOnStreak ? sand : neutral;

  if (compact) {
    return (
      <SurfaceCard
        tone={isOnStreak ? "sand" : "neutral"}
        padding={12}
        style={{ backgroundColor: tone.bg }}
      >
        <View className="flex-row items-center">
          <IconBadge
            icon={isOnStreak ? "flame-outline" : "moon-outline"}
            tone={isOnStreak ? "sand" : "neutral"}
            size="sm"
            style={{ marginRight: 8 }}
          />
          <Text style={{ ...typography.bodyMd, fontWeight: "700", color: tone.fg }}>
            {current} {current === 1 ? "day" : "days"}
          </Text>
        </View>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard tone="sand" accentColor={tone.fg} accentHeight={4}>
      <View>
        {/* Main streak display */}
        <View className="flex-row items-start justify-between">
          <View className="flex-row items-center">
            <View
              className="w-14 h-14 rounded-2xl items-center justify-center mr-4"
              style={{ backgroundColor: tone.bg }}
            >
              {isOnStreak && (
                <View
                  style={{
                    position: "absolute",
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: sand.ring,
                  }}
                />
              )}
              <Ionicons
                name={isOnStreak ? "flame" : "moon-outline"}
                size={28}
                color={tone.fg}
              />
            </View>

            <View
              accessible
              accessibilityRole="text"
              accessibilityLabel={`Current streak: ${current} ${current === 1 ? "day" : "days"}`}
            >
              <Text className="text-paper-700 dark:text-sand-400 mb-1" style={typography.eyebrow}>
                Current Streak
              </Text>
              <View className="flex-row items-baseline">
                <Text style={{ ...typography.metricLg, color: tone.fg }}>
                  {countedCurrent}
                </Text>
                <Text className="ml-2 text-paper-700 dark:text-sand-400" style={typography.bodyMd}>
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
                backgroundColor: sage.bg,
                borderWidth: 1,
                borderColor: sage.border,
              }}
            >
              <Text
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: sage.fg }}
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
              <Text className="text-xs font-medium text-paper-700 dark:text-sand-400">
                Progress to personal best
              </Text>
              <Text className="text-xs font-bold text-paper-700 dark:text-sand-300">
                {longest} days
              </Text>
            </View>
            <View
              className="h-3 rounded-full overflow-hidden"
              style={{ backgroundColor: sand.border }}
            >
              <Animated.View
                className="h-full rounded-full"
                style={[{ backgroundColor: tone.fg }, progressAnimatedStyle]}
              />
            </View>
          </View>
        )}

        {/* Stats row */}
        <View
          className="flex-row mt-5 pt-4"
          style={{ borderTopWidth: 1, borderTopColor: sand.border }}
        >
          <View className="flex-1 items-center">
            <IconBadge icon="trophy-outline" tone="sand" size="sm" style={{ marginBottom: 8 }} />
            <Text className="text-xs text-paper-700 dark:text-sand-400 mb-0.5">
              Personal Best
            </Text>
            <Text className="text-lg font-bold text-paper-700 dark:text-paper-300">
              {longest} {longest === 1 ? "day" : "days"}
            </Text>
          </View>

          <View className="w-px mx-4" style={{ backgroundColor: sand.border }} />

          <View className="flex-1 items-center">
            <IconBadge
              icon={isOnStreak ? "checkmark" : "moon-outline"}
              tone={isOnStreak ? "sage" : "neutral"}
              size="sm"
              style={{ marginBottom: 8 }}
            />
            <Text className="text-xs text-paper-700 dark:text-sand-400 mb-0.5">
              Status
            </Text>
            <Text
              className="text-lg font-bold"
              style={{ color: isOnStreak ? sage.fg : neutral.fg }}
            >
              {isOnStreak ? "Active" : "Paused"}
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
