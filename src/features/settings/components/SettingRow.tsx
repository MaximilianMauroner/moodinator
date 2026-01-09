import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export function SettingRow({
  label,
  subLabel,
  action,
  onPress,
  isLast,
  icon,
  destructive,
}: {
  label: string;
  subLabel?: string;
  action?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-between p-4 ${
        !isLast ? "border-b border-slate-100 dark:border-slate-800" : ""
      } ${onPress ? "active:bg-slate-50 dark:active:bg-slate-800/50" : ""}`}
    >
      <View className="flex-row items-center flex-1 mr-4">
        {icon && (
          <View
            className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
              destructive
                ? "bg-red-100 dark:bg-red-900/20"
                : "bg-slate-100 dark:bg-slate-800"
            }`}
          >
            <Ionicons
              name={icon}
              size={18}
              color={destructive ? "#ef4444" : "#64748b"}
            />
          </View>
        )}
        <View className="flex-1">
          <Text
            className={`text-base font-medium ${
              destructive
                ? "text-red-600 dark:text-red-400"
                : "text-slate-900 dark:text-slate-100"
            }`}
          >
            {label}
          </Text>
          {subLabel && (
            <Text className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-5">
              {subLabel}
            </Text>
          )}
        </View>
      </View>
      {action && <View>{action}</View>}
      {!action && onPress && (
        <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
      )}
    </Pressable>
  );
}

