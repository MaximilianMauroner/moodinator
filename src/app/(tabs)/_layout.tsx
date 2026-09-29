import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import TabBarBackground from "@/components/ui/TabBarBackground";
import { useColorScheme } from "@/hooks/useColorScheme";
import { TAB_ACCESSIBILITY_LABELS } from "@/constants/accessibility";
import { useToastTabBarHeight } from "@/hooks/useToastOffset";
import { emitHomeTabDoublePress } from "@/lib/homeTabEvents";
import { getThemedColor } from "@/constants/colors";

function MeasuredTabBarBackground() {
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={({ nativeEvent }) => {
        useToastTabBarHeight.setState({ height: nativeEvent.layout.height });
      }}
    >
      <TabBarBackground />
    </View>
  );
}

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

  // Tab chrome uses the same Soft Sage tokens as the screens.
  const colors = {
    active: getThemedColor("primary", isDark),
    inactive: getThemedColor("textSubtle", isDark),
    background: getThemedColor("background", isDark),
    border: getThemedColor("border", isDark),
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: MeasuredTabBarBackground,
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
          title: "Today",
          tabBarButton: HomeTabButton,
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="house.fill" color={color} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY_LABELS.today,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="clock.arrow.circlepath" color={color} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY_LABELS.history,
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
          // Reached through the gear in each screen header, not the tab bar.
          href: null,
        }}
      />
    </Tabs>
  );
}
