import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { useRouter } from "expo-router";

type AccentColor = "sage" | "sand" | "coral" | "dusk";

interface SettingsPageHeaderProps {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor?: AccentColor;
}

export function SettingsPageHeader({
  title,
  subtitle,
  icon,
  accentColor = "sage",
}: SettingsPageHeaderProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();

  const accentColors = {
    sage: {
      iconBg: isDark ? "#2D3D2D" : "#E8EFE8",
      iconColor: isDark ? "#A8C5A8" : "#5B8A5B",
      subtitleColor: isDark ? "#A8C5A8" : "#5B8A5B",
    },
    sand: {
      iconBg: isDark ? "#302A22" : "#F9F5ED",
      iconColor: isDark ? "#D4C4A0" : "#9D8660",
      subtitleColor: isDark ? "#D4C4A0" : "#9D8660",
    },
    coral: {
      iconBg: isDark ? "#3D2822" : "#FDE8E4",
      iconColor: isDark ? "#F5A899" : "#E06B55",
      subtitleColor: isDark ? "#F5A899" : "#E06B55",
    },
    dusk: {
      iconBg: isDark ? "#2D2A33" : "#EFECF2",
      iconColor: isDark ? "#C4BBCF" : "#847596",
      subtitleColor: isDark ? "#C4BBCF" : "#847596",
    },
  };

  const colors = accentColors[accentColor];

  return (
    <View className="px-4 pt-2 pb-4 bg-paper-100 dark:bg-paper-900">
      {/* Back button row */}
      <TouchableOpacity
        onPress={() => router.back()}
        className="flex-row items-center py-2 -ml-1 mb-3"
        activeOpacity={0.7}
      >
        <Ionicons
          name="chevron-back"
          size={24}
          color={isDark ? "#A8C5A8" : "#5B8A5B"}
        />
        <Text
          className="text-base font-medium ml-1"
          style={{ color: isDark ? "#A8C5A8" : "#5B8A5B" }}
        >
          Settings
        </Text>
      </TouchableOpacity>

      {/* Title row with icon */}
      <View className="flex-row items-center">
        <View
          className="w-14 h-14 rounded-2xl items-center justify-center mr-4"
          style={{ backgroundColor: colors.iconBg }}
        >
          <Ionicons name={icon} size={28} color={colors.iconColor} />
        </View>
        <View className="flex-1">
          {subtitle && (
            <Text
              className="text-xs font-medium mb-0.5"
              style={{ color: colors.subtitleColor }}
            >
              {subtitle}
            </Text>
          )}
          <Text className="text-2xl font-bold text-paper-800 dark:text-paper-200 tracking-tight">
            {title}
          </Text>
        </View>
      </View>
    </View>
  );
}
