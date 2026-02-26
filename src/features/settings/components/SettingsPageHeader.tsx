import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/components/ui/ScreenHeader";

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
  const router = useRouter();

  return (
    <View className="pt-2 pb-4 bg-paper-100 dark:bg-paper-900">
      <ScreenHeader
        title={title}
        eyebrow={subtitle}
        icon={icon}
        tone={accentColor}
        compact
        onBack={() => router.back()}
        backLabel="Back to settings"
      />
    </View>
  );
}
