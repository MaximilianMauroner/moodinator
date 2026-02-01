import React from "react";
import { View, Text } from "react-native";

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
        <View className="w-7 h-7 rounded-full items-center justify-center mr-2 bg-sage-100 dark:bg-sage-600/30">
          <Text className="text-sm">{icon}</Text>
        </View>
      )}
      <Text className="text-sm font-semibold text-sand-600 dark:text-sand-400">
        {title}
      </Text>
    </View>
  );
}
