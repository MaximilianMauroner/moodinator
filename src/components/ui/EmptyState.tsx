import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/constants/colors";
import { typography } from "@/constants/typography";
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
  const resolvedIcon = icon ?? "document-text-outline";
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
          <View className="items-center justify-center mb-4">
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
          </View>

          <Text
            className="text-center text-paper-800 dark:text-paper-200"
            style={[typography.titleMd, { maxWidth: contentWidth, marginBottom: 8 }]}
          >
            {title}
          </Text>

          {description && (
            <Text
              className="text-center"
              style={[typography.bodyMd, { color: get("textMuted"), maxWidth: contentWidth }]}
            >
              {description}
            </Text>
          )}

          {actionLabel && onAction && (
            <Pressable
              onPress={onAction}
              className="mt-6 px-6 rounded-2xl items-center justify-center"
              style={({ pressed }) => [
                {
                  backgroundColor: get("primary"),
                  minWidth: 132,
                  minHeight: 44,
                },
                pressed ? { opacity: 0.85 } : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
            >
              <Text className="text-white font-semibold" style={typography.bodyMd}>
                {actionLabel}
              </Text>
            </Pressable>
          )}
        </View>
      </SurfaceCard>
    </View>
  );
}

export default EmptyState;
