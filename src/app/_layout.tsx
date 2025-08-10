import React from "react";
import { View } from "react-native";
import { Stack } from "expo-router";

import "./global.css";
import { useNotifications } from "@/hooks/useNotifications";

export default function Layout() {
  useNotifications();
  return (
    // Provide a dark-aware background across the entire app so transparent screens/blur bars look correct
    <View className="flex-1 bg-white dark:bg-slate-950">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: "transparent",
          },
        }}
      />
    </View>
  );
}
