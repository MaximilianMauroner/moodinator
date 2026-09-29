import React from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useThemeColors } from "@/constants/colors";

/** Opens Settings, which is no longer a bottom tab. */
export function SettingsGearButton() {
  const { get } = useThemeColors();
  return (
    <Pressable
      onPress={() => router.push("/settings")}
      className="h-11 w-11 items-center justify-center rounded-full active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel="Settings"
      accessibilityHint="Opens app settings"
      testID="open-settings"
    >
      <Ionicons name="settings-outline" size={22} color={get("textMuted")} />
    </Pressable>
  );
}
