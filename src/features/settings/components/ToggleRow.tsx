import React, { memo } from "react";
import { Switch, Platform } from "react-native";
import { SettingRow } from "./SettingRow";

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
  return (
    <SettingRow
      label={title}
      subLabel={description}
      isLast={isLast}
      action={
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: "#e2e8f0", true: "#3b82f6" }}
          thumbColor={Platform.OS === "ios" ? undefined : "#fff"}
        />
      }
    />
  );
});

