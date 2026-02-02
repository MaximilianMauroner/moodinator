import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColorScheme } from "nativewind";

interface SettingsSectionProps {
  title?: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View className="mx-4 mb-4">
      {title && (
        <Text className="text-xs font-semibold uppercase tracking-wider text-sand-500 dark:text-sand-400 mb-2 ml-1">
          {title}
        </Text>
      )}
      <View
        className="rounded-2xl bg-paper-50 dark:bg-paper-850 overflow-hidden"
        style={isDark ? styles.sectionShadowDark : styles.sectionShadowLight}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionShadowLight: {
    elevation: 2,
    shadowColor: "#9D8660",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  sectionShadowDark: {
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
});
