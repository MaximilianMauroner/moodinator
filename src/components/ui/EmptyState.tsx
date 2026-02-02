import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/constants/colors";

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  emoji?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
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
}: EmptyStateProps) {
  const { get, isDark } = useThemeColors();

  return (
    <View
      className="flex-1 items-center justify-center p-8"
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${title}${description ? `. ${description}` : ""}`}
    >
      <View
        className="w-24 h-24 rounded-3xl items-center justify-center mb-5"
        style={{
          backgroundColor: get("primaryBg"),
          shadowColor: isDark ? "#000" : get("primary"),
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.3 : 0.15,
          shadowRadius: 16,
          elevation: 4,
        }}
      >
        {emoji ? (
          <Text className="text-5xl">{emoji}</Text>
        ) : icon ? (
          <Ionicons name={icon} size={48} color={get("primary")} />
        ) : (
          <Text className="text-5xl">📋</Text>
        )}
      </View>

      <Text
        className="text-center font-semibold text-lg mb-1"
        style={{ color: get("text") }}
      >
        {title}
      </Text>

      {description && (
        <Text
          className="text-center text-sm max-w-[200px]"
          style={{ color: get("textMuted") }}
        >
          {description}
        </Text>
      )}

      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          className="mt-6 px-6 py-3 rounded-xl"
          style={{ backgroundColor: get("primary") }}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text className="text-white font-semibold">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default EmptyState;
