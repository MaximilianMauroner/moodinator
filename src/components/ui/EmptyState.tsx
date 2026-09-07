import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated";
import { useThemeColors } from "@/constants/colors";
import { typography } from "@/constants/typography";
import { motion, springs } from "@/constants/motion";
import { usePressAnimation } from "@/hooks/usePressAnimation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SurfaceCard } from "./SurfaceCard";
import { IconBadge } from "./IconBadge";

type EmptyTone = "sage" | "sand" | "coral" | "dusk" | "neutral";

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  emoji?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: EmptyTone;
}

/**
 * Empty state component with icon/emoji, title, description, and optional action button.
 * Used for lists and screens with no data.
 */
export function EmptyState({
  icon,
  emoji,
  title,
  description,
  actionLabel,
  onAction,
  tone = "sage",
}: EmptyStateProps) {
  const { get, isDark } = useThemeColors();
  const reducedMotion = useReducedMotion();
  const press = usePressAnimation();
  const resolvedIcon = icon ?? "document-text-outline";

  // The icon settles once, then the words arrive behind it. One shot, no loop.
  const iconEntering = reducedMotion
    ? undefined
    : ZoomIn.springify()
        .damping(springs.bouncy.damping)
        .stiffness(springs.bouncy.stiffness);
  const textEntering = (index: number) =>
    reducedMotion
      ? undefined
      : FadeInUp.duration(motion.duration.normal).delay(
          motion.stagger.tight * (index + 2)
        );
  const haloSize = 96;
  const contentWidth = 272;
  const accent = {
    sage: isDark ? "#7BA87B" : "#5B8A5B",
    sand: isDark ? "#D4C4A0" : "#9D8660",
    coral: isDark ? "#F5A899" : "#E06B55",
    dusk: isDark ? "#C4BBCF" : "#847596",
    neutral: isDark ? "#BDA77D" : "#7A6B55",
  }[tone];

  return (
    <View
      className="flex-1 items-center justify-center px-6 py-8"
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${title}${description ? `. ${description}` : ""}`}
    >
      <SurfaceCard
        tone={tone === "neutral" ? "sand" : tone}
        style={{ width: "100%", maxWidth: 360 }}
        contentStyle={{ alignItems: "center", paddingHorizontal: 24, paddingVertical: 28 }}
      >
        <View className="items-center w-full">
          <Animated.View
            entering={iconEntering}
            className="items-center justify-center mb-4"
          >
            <View
              pointerEvents="none"
              className="absolute"
              style={{
                width: haloSize,
                height: haloSize,
                borderRadius: haloSize / 2,
                backgroundColor: accent,
                opacity: isDark ? 0.14 : 0.08,
              }}
            />
            {emoji ? (
              <View
                className="w-16 h-16 rounded-2xl items-center justify-center"
                style={{ backgroundColor: get("surfaceElevated") }}
              >
                <Text className="text-3xl">{emoji}</Text>
              </View>
            ) : (
              <IconBadge icon={resolvedIcon} tone={tone} size="lg" />
            )}
          </Animated.View>

          <Animated.Text
            entering={textEntering(0)}
            className="text-center text-paper-800 dark:text-paper-200"
            style={[typography.titleMd, { maxWidth: contentWidth, marginBottom: 8 }]}
          >
            {title}
          </Animated.Text>

          {description && (
            <Animated.Text
              entering={textEntering(1)}
              className="text-center"
              style={[typography.bodyMd, { color: get("textMuted"), maxWidth: contentWidth }]}
            >
              {description}
            </Animated.Text>
          )}

          {actionLabel && onAction && (
            <Pressable
              className="mt-6"
              onPress={onAction}
              onPressIn={press.onPressIn}
              onPressOut={press.onPressOut}
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
            >
              <Animated.View
                className="px-6 rounded-2xl items-center justify-center"
                style={[
                  {
                    backgroundColor: get("primary"),
                    minWidth: 132,
                    minHeight: 44,
                  },
                  press.animatedStyle,
                ]}
              >
                <Text
                  className="font-semibold"
                  style={[typography.bodyMd, { color: get("onPrimary") }]}
                >
                  {actionLabel}
                </Text>
              </Animated.View>
            </Pressable>
          )}
        </View>
      </SurfaceCard>
    </View>
  );
}

export default EmptyState;
