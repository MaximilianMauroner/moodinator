import React from "react";
import { View } from "react-native";
import { Stack } from "expo-router";

import "./global.css";
export default function Layout() {
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
