import React, { memo } from "react";
import { Switch, Platform } from "react-native";
import { useColorScheme } from "nativewind";
import { Ionicons } from "@expo/vector-icons";
import { SettingRow } from "./SettingRow";
import { SETTINGS_ACCESSIBILITY } from "@/constants/accessibility";

export const ToggleRow = memo(function ToggleRow({
  title,
  description,
  value,
  onChange,
  isLast,
  icon,
  disabled,
}: {
  title: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  isLast?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <SettingRow
      label={title}
      subLabel={description}
      isLast={isLast}
      icon={icon}
      action={
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          trackColor={{
            false: isDark ? "#3D352A" : "#E5D9BF",
            true: disabled ? "#8FBB8F" : "#5B8A5B",
          }}
          thumbColor={Platform.OS === "ios" ? undefined : "#fff"}
          ios_backgroundColor={isDark ? "#3D352A" : "#E5D9BF"}
          accessibilityLabel={SETTINGS_ACCESSIBILITY.toggle(value, title)}
          accessibilityHint={SETTINGS_ACCESSIBILITY.toggleHint(value)}
          accessibilityRole="switch"
        />
      }
    />
  );
});
