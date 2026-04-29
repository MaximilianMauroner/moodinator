import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { typography } from "@/constants/typography";
import { IconBadge } from "./IconBadge";

type Tone = "sage" | "sand" | "coral" | "dusk" | "neutral";

interface ScreenHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
  onBack?: () => void;
  backLabel?: string;
  trailing?: React.ReactNode;
  compact?: boolean;
}

export function ScreenHeader({
  title,
  eyebrow,
  subtitle,
  icon,
  tone = "sage",
  onBack,
  backLabel = "Back",
  trailing,
  compact = false,
}: ScreenHeaderProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const accentText = {
    sage: isDark ? "#A8C5A8" : "#5B8A5B",
    sand: isDark ? "#D4C4A0" : "#7A6545",
    coral: isDark ? "#F5A899" : "#E06B55",
    dusk: isDark ? "#C4BBCF" : "#847596",
    neutral: isDark ? "#BDA77D" : "#6B5C4A",
  }[tone];

  return (
    <View className={compact ? "px-4 pt-2 pb-4" : "px-6 py-5"}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          className="flex-row items-center py-2 -ml-1 mb-3 self-start"
          style={({ pressed }) => (pressed ? { opacity: 0.72 } : null)}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
        >
          <Ionicons name="chevron-back" size={22} color={accentText} />
          <Text
            className="ml-1"
            style={[typography.bodyMd, { color: accentText, fontWeight: "600" }]}
          >
            {backLabel}
          </Text>
        </Pressable>
      ) : null}

      <View className="flex-row items-end justify-between">
        <View className="flex-row items-center flex-1 pr-3">
          {icon ? (
            <IconBadge
              icon={icon}
              tone={tone}
              size={compact ? "md" : "lg"}
              style={{ marginRight: compact ? 12 : 14 }}
            />
          ) : null}
          <View className="flex-1">
            {eyebrow ? (
              <Text style={[typography.eyebrow, { color: accentText, marginBottom: 3 }]}>
                {eyebrow}
              </Text>
            ) : null}
            <Text
              className="text-paper-800 dark:text-paper-200"
              style={compact ? typography.titleMd : typography.titleLg}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                className="text-sand-600 dark:text-sand-400 mt-1"
                style={typography.subtitle}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {trailing ? <View>{trailing}</View> : null}
      </View>
    </View>
  );
}

export default ScreenHeader;
