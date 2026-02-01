import React, { memo } from "react";
import { Switch, Platform } from "react-native";
import { useColorScheme } from "nativewind";
import { SettingRow } from "./SettingRow";
import { SETTINGS_ACCESSIBILITY } from "@/constants/accessibility";

export const ToggleRow = memo(function ToggleRow({
  title,
  description,
  value,
  onChange,
  isLast,
}: {
  title: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  isLast?: boolean;
}) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <SettingRow
      label={title}
      subLabel={description}
      isLast={isLast}
      action={
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{
            false: isDark ? "#3D352A" : "#E5D9BF",
            true: "#5B8A5B",
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
