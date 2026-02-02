import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { haptics } from "@/lib/haptics";

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
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const handlePress = () => {
    if (onPress) {
      haptics.light();
      onPress();
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      className={`flex-row items-center justify-between p-4 ${
        !isLast ? "border-b border-paper-200 dark:border-paper-800" : ""
      }`}
      style={onPress && { opacity: 1 }}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={subLabel ? `${label}, ${subLabel}` : label}
      accessibilityHint={onPress ? "Tap to open" : undefined}
    >
      <View className="flex-row items-center flex-1 mr-4">
        {icon && (
          <View
            className={`w-9 h-9 rounded-xl items-center justify-center mr-3 ${
              destructive
                ? "bg-coral-100 dark:bg-coral-600/20"
                : "bg-sage-100 dark:bg-sage-600/20"
            }`}
          >
            <Ionicons
              name={icon}
              size={18}
              color={
                destructive
                  ? isDark ? "#F5A899" : "#C75441"
                  : isDark ? "#A8C5A8" : "#5B8A5B"
              }
            />
          </View>
        )}
        <View className="flex-1">
          <Text
            className={`text-base font-medium ${
              destructive
                ? "text-coral-600 dark:text-coral-300"
                : "text-paper-800 dark:text-paper-200"
            }`}
          >
            {label}
          </Text>
          {subLabel && (
            <Text className="text-sm mt-0.5 leading-5 text-sand-500 dark:text-sand-800">
              {subLabel}
            </Text>
          )}
        </View>
      </View>
      {action && <View>{action}</View>}
      {!action && onPress && (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={isDark ? "#6B5C4A" : "#BDA77D"}
        />
      )}
    </Pressable>
  );
}
