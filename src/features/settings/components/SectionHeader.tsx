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
      {icon && <Text className="mr-2 text-lg">{icon}</Text>}
      <Text className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </Text>
    </View>
  );
}

