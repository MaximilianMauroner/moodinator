import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { semanticToneColors, type SemanticTone } from "@/constants/colors";

type Tone = SemanticTone;
type Size = "sm" | "md" | "lg";

const sizeMap = {
  sm: { box: 34, radius: 12, icon: 16, inner: 8 },
  md: { box: 42, radius: 14, icon: 20, inner: 10 },
  lg: { box: 56, radius: 18, icon: 26, inner: 14 },
} as const;

interface IconBadgeProps {
  icon: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
  size?: Size;
  style?: StyleProp<ViewStyle>;
}

export function IconBadge({
  icon,
  tone = "sage",
  size = "md",
  style,
}: IconBadgeProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const palette = isDark ? semanticToneColors[tone].dark : semanticToneColors[tone].light;
  const dims = sizeMap[size];

  return (
    <View
      style={[
        styles.container,
        {
          width: dims.box,
          height: dims.box,
          borderRadius: dims.radius,
          backgroundColor: palette.bg,
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: dims.inner / 2,
          left: dims.inner / 2,
          right: dims.inner / 2,
          bottom: dims.inner / 2,
          borderRadius: Math.max(8, dims.radius - 6),
          backgroundColor: palette.ring,
        }}
      />
      <Ionicons name={icon} size={dims.icon} color={palette.fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});

export default IconBadge;
