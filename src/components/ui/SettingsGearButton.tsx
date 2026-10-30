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
      className="h-[48px] w-[48px] items-center justify-center rounded-full active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel="Settings"
      accessibilityHint="Opens app settings"
      testID="open-settings"
    >
      <Ionicons name="settings-outline" size={22} color={get("textMuted")} />
    </Pressable>
  );
}
