import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";

import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import TabBarBackground from "@/components/ui/TabBarBackground";
import { useColorScheme } from "@/hooks/useColorScheme";
import { TAB_ACCESSIBILITY_LABELS } from "@/constants/accessibility";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Soft Organic palette
  const colors = {
    active: isDark ? "#A8C5A8" : "#5B8A5B",
    inactive: isDark ? "#6B5C4A" : "#BDA77D",
    background: isDark ? "#1C1916" : "#FAF8F4",
    border: isDark ? "#2A2520" : "#E5D9BF",
  };

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
          },
          default: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            elevation: 0,
          },
        }),
        tabBarLabelStyle: {
          fontWeight: "600",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="house.fill" color={color} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY_LABELS.home,
        }}
      />
      <Tabs.Screen
        name="charts"
        options={{
          title: "Insights",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="chart.bar" color={color} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY_LABELS.insights,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="gear" color={color} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY_LABELS.settings,
        }}
      />
    </Tabs>
  );
}
