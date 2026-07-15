import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { useRouter } from "expo-router";
import {
  colors as themeColors,
  effectColors,
  semanticToneColors,
} from "@/constants/colors";

const settingsCategoryColors = {
  sage: {
    iconBg: themeColors.primaryBg,
    iconColor: themeColors.positive.text,
    accentLine: { light: themeColors.primaryMuted.light, dark: themeColors.primary.dark },
    badgeBg: { light: themeColors.primaryBg.light, dark: "rgba(166, 227, 155, 0.13)" },
    badgeText: themeColors.positive.text,
  },
  sand: {
    iconBg: { light: themeColors.sand.bg.light, dark: "#342B1D" },
    iconColor: themeColors.sand.text,
    accentLine: { light: "#D4C4A0", dark: themeColors.sand.bgSelected.dark },
    badgeBg: { light: themeColors.sand.bg.light, dark: "rgba(195, 166, 111, 0.13)" },
    badgeText: themeColors.sand.text,
  },
  coral: {
    iconBg: { light: themeColors.negative.bg.light, dark: semanticToneColors.coral.dark.bg },
    iconColor: themeColors.negative.text,
    accentLine: { light: "#F5A899", dark: themeColors.negative.bgSelected.dark },
    badgeBg: { light: themeColors.negative.bg.light, dark: "rgba(216, 117, 97, 0.18)" },
    badgeText: themeColors.negative.text,
  },
  dusk: {
    iconBg: themeColors.dusk.bg,
    iconColor: { light: themeColors.dusk.bgSelected.light, dark: themeColors.dusk.text.dark },
    accentLine: themeColors.dusk.bgSelected,
    badgeBg: { light: themeColors.dusk.bg.light, dark: "rgba(138, 122, 160, 0.18)" },
    badgeText: { light: themeColors.dusk.bgSelected.light, dark: themeColors.dusk.text.dark },
  },
} as const;

type AccentColor = keyof typeof settingsCategoryColors;

interface SettingsCategoryCardProps {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  accentColor?: AccentColor;
  badge?: string | number;
  preview?: string;
}

export function SettingsCategoryCard({
  title,
  description,
  icon,
  href,
  accentColor = "sage",
  badge,
  preview,
}: SettingsCategoryCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();

  const palette = settingsCategoryColors[accentColor];
  const colors = {
    iconBg: isDark ? palette.iconBg.dark : palette.iconBg.light,
    iconColor: isDark ? palette.iconColor.dark : palette.iconColor.light,
    accentLine: isDark ? palette.accentLine.dark : palette.accentLine.light,
    badgeBg: isDark ? palette.badgeBg.dark : palette.badgeBg.light,
    badgeText: isDark ? palette.badgeText.dark : palette.badgeText.light,
  };

  return (
    <TouchableOpacity
      onPress={() => router.push(href as never)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${title} settings`}
    >
      <View
        className="rounded-3xl border border-paper-200 bg-paper-50 dark:border-paper-800 dark:bg-paper-800 overflow-hidden"
        style={isDark ? styles.cardShadowDark : styles.cardShadowLight}
      >
        {/* Left accent bar */}
        <View className="flex-row">
          <View
            style={{
              width: 4,
              backgroundColor: colors.accentLine,
            }}
          />

          <View className="flex-1 p-4">
            <View className="flex-row items-center">
              {/* Icon */}
              <View
                className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
                style={{ backgroundColor: colors.iconBg }}
              >
                <Ionicons name={icon} size={24} color={colors.iconColor} />
              </View>

              {/* Content */}
              <View className="flex-1 mr-3">
                <View className="flex-row items-center mb-1">
                  <Text className="text-base font-bold text-paper-800 dark:text-paper-200 tracking-tight">
                    {title}
                  </Text>
                  {badge !== undefined && (
                    <View
                      className="ml-2 px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: colors.badgeBg }}
                    >
                      <Text
                        className="text-xs font-bold"
                        style={{ color: colors.badgeText }}
                      >
                        {badge}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  className="text-xs text-paper-700 dark:text-paper-400"
                  numberOfLines={1}
                >
                  {description}
                </Text>
                {preview && (
                  <Text
                    className="text-xs text-sage-600 dark:text-sage-300 mt-1"
                    numberOfLines={1}
                  >
                    {preview}
                  </Text>
                )}
              </View>

              {/* Chevron */}
              <View
                className="w-8 h-8 rounded-xl items-center justify-center"
                style={{
                  backgroundColor: isDark
                    ? themeColors.surfaceAlt.dark
                    : themeColors.surfaceAlt.light,
                }}
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={isDark ? themeColors.textSubtle.dark : themeColors.textSubtle.light}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardShadowLight: {
    elevation: 2,
    shadowColor: effectColors.shadow.light,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardShadowDark: {
    elevation: 0,
    shadowColor: effectColors.shadow.black,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
});
