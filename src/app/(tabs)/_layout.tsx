import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import TabBarBackground from "@/components/ui/TabBarBackground";
import { useColorScheme } from "@/hooks/useColorScheme";
import { TAB_ACCESSIBILITY_LABELS } from "@/constants/accessibility";
import { emitHomeTabDoublePress } from "@/lib/homeTabEvents";

const HOME_TAB_DOUBLE_PRESS_MS = 450;

function HomeTabButton(props: BottomTabBarButtonProps) {
  const lastSelectedPressAtRef = React.useRef(0);

  return (
    <HapticTab
      {...props}
      onPress={(event) => {
        const now = Date.now();

        if (now - lastSelectedPressAtRef.current <= HOME_TAB_DOUBLE_PRESS_MS) {
          lastSelectedPressAtRef.current = 0;
          emitHomeTabDoublePress();
        } else {
          lastSelectedPressAtRef.current = now;
        }

        props.onPress?.(event);
      }}
    />
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Soft Organic palette: tab chrome follows the same botanical night tokens
  // as the screens so dark mode keeps the warm field-journal feel.
  const colors = {
    active: isDark ? "#A6E39B" : "#476D47",
    inactive: isDark ? "#9EB894" : "#7A6B55",
    background: isDark ? "#08150F" : "#FAF8F4",
    border: isDark ? "#233D2D" : "#E5D9BF",
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
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarButton: HomeTabButton,
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="house.fill" color={color} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY_LABELS.home,
        }}
      />
      <Tabs.Screen
        name="charts"
        options={{
          title: "Insights",
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="chart.bar" color={color} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY_LABELS.insights,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="gear" color={color} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY_LABELS.settings,
        }}
      />
    </Tabs>
  );
}
