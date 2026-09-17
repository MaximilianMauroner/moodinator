import React, { memo, useCallback } from "react";
import { Switch, Platform } from "react-native";
import { useColorScheme } from "nativewind";
import { Ionicons } from "@expo/vector-icons";
import { SettingRow } from "./SettingRow";
import { SETTINGS_ACCESSIBILITY } from "@/constants/accessibility";
import { haptics } from "@/lib/haptics";
import { getThemedColor } from "@/constants/colors";

export const ToggleRow = memo(function ToggleRow({
  title,
  description,
  value,
  onChange,
  isLast,
  icon,
  feedback = "tick",
}: {
  title: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  isLast?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  feedback?: "tap" | "tick";
}) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // A switch moves a value, so it fires the same level as any other selection.
  const handleValueChange = useCallback(
    (next: boolean) => {
      onChange(next);
      haptics[feedback]();
    },
    [feedback, onChange]
  );

  return (
    <SettingRow
      label={title}
      subLabel={description}
      isLast={isLast}
      icon={icon}
      action={
        <Switch
          value={value}
          onValueChange={handleValueChange}
          trackColor={{
            false: getThemedColor("textOnSand", isDark),
            true: "#5B8A5B",
          }}
          thumbColor={Platform.OS === "ios" ? undefined : "#fff"}
          ios_backgroundColor={getThemedColor("textOnSand", isDark)}
          accessibilityLabel={title}
          accessibilityHint={SETTINGS_ACCESSIBILITY.toggleHint(value)}
          accessibilityRole="switch"
          accessibilityState={{ checked: value }}
        />
      }
    />
  );
});
