import React from "react";
import { View, StyleSheet } from "react-native";
import { useColorScheme } from "nativewind";

export function SettingCard({ children }: { children: React.ReactNode }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View
      className="rounded-3xl overflow-hidden bg-paper-50 dark:bg-paper-850"
      style={isDark ? styles.cardShadowDark : styles.cardShadowLight}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadowLight: {
    elevation: 3,
    shadowColor: "#9D8660",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cardShadowDark: {
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
});
