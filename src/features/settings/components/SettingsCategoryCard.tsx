import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { useRouter } from "expo-router";

type AccentColor = "sage" | "sand" | "coral" | "dusk";

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

  const accentColors = {
    sage: {
      iconBg: isDark ? "#2D3D2D" : "#E8EFE8",
      iconColor: isDark ? "#A8C5A8" : "#5B8A5B",
      accentLine: isDark ? "#5B8A5B" : "#7BA87B",
      badgeBg: isDark ? "rgba(91, 138, 91, 0.2)" : "#E8EFE8",
      badgeText: isDark ? "#A8C5A8" : "#5B8A5B",
    },
    sand: {
      iconBg: isDark ? "#302A22" : "#F9F5ED",
      iconColor: isDark ? "#D4C4A0" : "#9D8660",
      accentLine: isDark ? "#BDA77D" : "#D4C4A0",
      badgeBg: isDark ? "rgba(189, 167, 125, 0.2)" : "#F9F5ED",
      badgeText: isDark ? "#D4C4A0" : "#9D8660",
    },
    coral: {
      iconBg: isDark ? "#3D2822" : "#FDE8E4",
      iconColor: isDark ? "#F5A899" : "#E06B55",
      accentLine: isDark ? "#E06B55" : "#F5A899",
      badgeBg: isDark ? "rgba(224, 107, 85, 0.2)" : "#FDE8E4",
      badgeText: isDark ? "#F5A899" : "#E06B55",
    },
    dusk: {
      iconBg: isDark ? "#2D2A33" : "#EFECF2",
      iconColor: isDark ? "#C4BBCF" : "#847596",
      accentLine: isDark ? "#847596" : "#A396B3",
      badgeBg: isDark ? "rgba(132, 117, 150, 0.2)" : "#EFECF2",
      badgeText: isDark ? "#C4BBCF" : "#847596",
    },
  };

  const colors = accentColors[accentColor];

  return (
    <TouchableOpacity
      onPress={() => router.push(href as never)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${title} settings`}
    >
      <View
        className="rounded-3xl bg-paper-50 dark:bg-paper-850 overflow-hidden"
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
                  className="text-xs text-sand-500 dark:text-sand-400"
                  numberOfLines={1}
                >
                  {description}
                </Text>
                {preview && (
                  <Text
                    className="text-xs text-paper-500 dark:text-paper-500 mt-1"
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
                  backgroundColor: isDark ? "#2A2520" : "#F5F1E8",
                }}
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={isDark ? "#6B5C4A" : "#9D8660"}
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
    shadowColor: "#9D8660",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardShadowDark: {
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
});
