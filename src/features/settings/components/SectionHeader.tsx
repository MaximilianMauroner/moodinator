import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { IconBadge } from "@/components/ui/IconBadge";
import { typography } from "@/constants/typography";

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  "🎨": "color-palette-outline",
  "🔔": "notifications-outline",
  "🛠️": "construct-outline",
  "⚡": "flash-outline",
  "✨": "sparkles-outline",
  "💾": "save-outline",
  "📖": "book-outline",
};

export function SectionHeader({
  title,
  icon,
}: {
  title: string;
  icon?: string;
}) {
  return (
    <View className="flex-row items-center mb-3 mt-6 px-1">
      {icon && (
        ICON_MAP[icon] ? (
          <IconBadge icon={ICON_MAP[icon]} tone="sage" size="sm" style={{ marginRight: 8 }} />
        ) : (
          <View className="w-7 h-7 rounded-full items-center justify-center mr-2 bg-sage-100 dark:bg-sage-600/30">
            <Text className="text-sm">{icon}</Text>
          </View>
        )
      )}
      <Text className="text-sand-600 dark:text-sand-400" style={typography.bodyMd}>
        {title}
      </Text>
    </View>
  );
}
