import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import TabBarBackground from "@/components/ui/TabBarBackground";
import { useColorScheme } from "@/hooks/useColorScheme";
import { TAB_ACCESSIBILITY_LABELS } from "@/constants/accessibility";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  // Soft Organic palette — canvas matches `paper-100` (light) / `paper-900` (dark)
  // so every tab screen shares one background. Border uses `paper-850` for a
  // gentle separation against the canvas.
  const colors = {
    active: isDark ? "#A8C5A8" : "#5B8A5B",
    inactive: isDark ? "#8AAE98" : "#7A6B55",
    background: isDark ? "#1E2D26" : "#FAF8F4",
    border: isDark ? "#2E4438" : "#E5D9BF",
  };
  const compactTabBarHeight = 50;
  const compactBottomPadding = Math.max(insets.bottom - 4, 6);
  const compactTopPadding = 6;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarActiveTintColor: colors.active,
        tabBarInactiveTintColor: colors.inactive,
        sceneStyle: {
          backgroundColor: colors.background,
        },
        tabBarStyle: Platform.select({
          ios: {
            position: "absolute",
            backgroundColor: "transparent",
            height: compactTabBarHeight + insets.bottom,
            paddingTop: compactTopPadding,
            paddingBottom: compactBottomPadding,
          },
          default: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            elevation: 0,
            height: compactTabBarHeight + 10,
            paddingTop: compactTopPadding,
            paddingBottom: 8,
          },
        }),
        tabBarItemStyle: {
          paddingVertical: 0,
        },
        tabBarLabelStyle: {
          fontWeight: "600",
          fontSize: 10,
          marginTop: -1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="house.fill" color={color} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY_LABELS.home,
        }}
      />
      <Tabs.Screen
        name="charts"
        options={{
          title: "Insights",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="chart.bar" color={color} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY_LABELS.insights,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="gear" color={color} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY_LABELS.settings,
        }}
      />
    </Tabs>
  );
}
