import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { IconBadge } from "@/components/ui/IconBadge";
import { typography } from "@/constants/typography";

export function SectionHeader({
  title,
  icon,
}: {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View className="flex-row items-center mb-3 mt-6 px-1">
      {icon && (
        <IconBadge icon={icon} tone="sage" size="sm" style={{ marginRight: 8 }} />
      )}
      <Text className="text-sand-600 dark:text-sand-400" style={typography.bodyMd}>
        {title}
      </Text>
    </View>
  );
}
