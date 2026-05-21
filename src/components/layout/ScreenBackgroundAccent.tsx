import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useColorScheme } from "@/hooks/useColorScheme";

type ScreenBackgroundAccentProps = {
  density?: "default" | "compact";
};

export function ScreenBackgroundAccent({
  density = "default",
}: ScreenBackgroundAccentProps) {
  const isDark = useColorScheme() === "dark";
  const isCompact = density === "compact";
  const topFill = isDark
    ? "rgba(166, 227, 155, 0.08)"
    : "rgba(123, 168, 123, 0.055)";
  const leftFill = isDark
    ? "rgba(200, 245, 190, 0.04)"
    : "rgba(132, 117, 150, 0.045)";

  return (
    <>
      <View
        pointerEvents="none"
        style={[
          styles.accent,
          {
            top: isCompact ? -28 : -34,
            right: isCompact ? -42 : -34,
            width: isCompact ? 156 : 184,
            height: isCompact ? 142 : 164,
          },
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 184 164">
          <Path
            fill={topFill}
            d="M142.6 8.8c22.7 12.5 36.8 36.1 35.9 59.1-.9 23-16.8 45.4-38.1 61.7-21.2 16.2-47.9 26.4-73.4 20.2-25.5-6.1-49.8-28.5-54.2-54.1-4.4-25.6 11.1-54.3 34-72.3C69.7 5.3 100-2 142.6 8.8Z"
          />
        </Svg>
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.accent,
          {
            top: isCompact ? 32 : 42,
            left: isCompact ? -74 : -70,
            width: isCompact ? 126 : 150,
            height: isCompact ? 132 : 150,
          },
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 150 150">
          <Path
            fill={leftFill}
            d="M108.8 9.7c20.1 8.1 32.2 30.6 31.4 52.6-.8 21.9-14.5 43.3-34.8 57.4-20.3 14.2-47.1 21.1-66.5 10.8-19.4-10.4-31.3-38-26.2-63.6C17.8 41.2 39.9 17.4 62.9 9.5c23-7.8 25.8-7.9 45.9.2Z"
          />
        </Svg>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  accent: {
    position: "absolute",
  },
});

export default ScreenBackgroundAccent;
