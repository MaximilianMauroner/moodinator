import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { semanticToneColors, useThemeColors } from "@/constants/colors";
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
  const { isDark, get } = useThemeColors();
  const accentText = semanticToneColors[tone][isDark ? "dark" : "light"].fg;

  return (
    <View className={compact ? "px-4 pt-2 pb-3" : "px-6 pt-4 pb-4"}>
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

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1 pr-3">
          {icon ? (
            <IconBadge
              icon={icon}
              tone={tone}
              size={compact ? "sm" : "md"}
              style={{ marginRight: compact ? 10 : 12 }}
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
              style={typography.titleMd}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                className="mt-1"
                style={[typography.subtitle, { color: get("textMuted") }]}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {trailing ? <View className="items-end justify-center">{trailing}</View> : null}
      </View>
    </View>
  );
}

export default ScreenHeader;
