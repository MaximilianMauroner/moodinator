import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";

type Tone = "sage" | "sand" | "coral" | "dusk" | "neutral";
type Size = "sm" | "md" | "lg";

const tonePalette = {
  sage: {
    light: { bg: "#E8EFE8", fg: "#5B8A5B", ring: "rgba(91, 138, 91, 0.16)" },
    dark: { bg: "#2D3D2D", fg: "#A8C5A8", ring: "rgba(168, 197, 168, 0.18)" },
  },
  sand: {
    light: { bg: "#F9F5ED", fg: "#7A6545", ring: "rgba(157, 134, 96, 0.14)" },
    dark: { bg: "#302A22", fg: "#D4C4A0", ring: "rgba(212, 196, 160, 0.14)" },
  },
  coral: {
    light: { bg: "#FDE8E4", fg: "#E06B55", ring: "rgba(224, 107, 85, 0.16)" },
    dark: { bg: "#3D2822", fg: "#F5A899", ring: "rgba(245, 168, 153, 0.16)" },
  },
  dusk: {
    light: { bg: "#EFECF2", fg: "#847596", ring: "rgba(132, 117, 150, 0.16)" },
    dark: { bg: "#2D2A33", fg: "#C4BBCF", ring: "rgba(196, 187, 207, 0.16)" },
  },
  neutral: {
    light: { bg: "#F5F1E8", fg: "#6B5C4A", ring: "rgba(157, 134, 96, 0.14)" },
    dark: { bg: "#2A2520", fg: "#BDA77D", ring: "rgba(189, 167, 125, 0.14)" },
  },
} as const;

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
  const palette = isDark ? tonePalette[tone].dark : tonePalette[tone].light;
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

