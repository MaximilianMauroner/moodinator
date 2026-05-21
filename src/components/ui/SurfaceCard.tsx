import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useColorScheme } from "nativewind";
import { effectColors, semanticToneColors, type SemanticTone } from "@/constants/colors";

type Tone = SemanticTone;

interface SurfaceCardProps {
  children: React.ReactNode;
  tone?: Tone;
  accentColor?: string;
  accentHeight?: number;
  padding?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export function SurfaceCard({
  children,
  tone = "neutral",
  accentColor,
  accentHeight = 3,
  padding = 20,
  style,
  contentStyle,
}: SurfaceCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View
      className="rounded-3xl overflow-hidden bg-paper-50 dark:bg-paper-850"
      style={[
        isDark ? styles.shadowDark : styles.shadowLight,
        {
          borderWidth: 1,
          borderColor: isDark
            ? semanticToneColors[tone].dark.border
            : semanticToneColors[tone].light.border,
        },
        style,
      ]}
    >
      {accentColor ? (
        <View
          style={{
            height: accentHeight,
            backgroundColor: accentColor,
            opacity: 0.8,
          }}
        />
      ) : null}
      <View style={[{ padding }, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowLight: {
    elevation: 3,
    shadowColor: effectColors.shadow.light,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
  },
  shadowDark: {
    elevation: 3,
    shadowColor: effectColors.shadow.dark,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
  },
});

export default SurfaceCard;
