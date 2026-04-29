import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useColorScheme } from "nativewind";

type Tone = "neutral" | "sage" | "sand" | "dusk" | "coral";

const toneBorder = {
  neutral: { light: "#E5D9BF", dark: "#3D352A" },
  sage: { light: "#D1DFD1", dark: "#3D4D3D" },
  sand: { light: "#E9DCC1", dark: "#4A4032" },
  dusk: { light: "#DDD8E5", dark: "#3D3A43" },
  coral: { light: "#FACFC7", dark: "#4D3832" },
} as const;

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
          borderColor: isDark ? toneBorder[tone].dark : toneBorder[tone].light,
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
    shadowColor: "#9D8660",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
  },
  shadowDark: {
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
  },
});

export default SurfaceCard;
