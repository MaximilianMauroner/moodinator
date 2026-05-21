import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColorScheme } from "@/hooks/useColorScheme";
import { typography } from "@/constants/typography";
import { colors } from "@/constants/colors";

const DOT_SIZE = 3;
const ASTERISM_WIDTH = 16;

interface SettingsHeaderProps {
  subtitle?: string;
}

/**
 * Settings carries a literary "asterism" — three small sand-toned dots arranged
 * in a triangle, a classical section-divider mark from print typography. It
 * gives the page a quiet journal voice without leaning on UI metaphors, and
 * keeps the surface clearly distinct from the home brand mark and the insights
 * mood rhythm.
 */
export function SettingsHeader({
  subtitle = "Tune fields, privacy, and exports",
}: SettingsHeaderProps) {
  const isDark = useColorScheme() === "dark";

  const dotColor = isDark ? colors.sand.text.dark : colors.sand.bgSelected.light;
  const titleColor = isDark ? colors.text.dark : colors.text.light;
  const subtitleColor = isDark ? colors.textSubtle.dark : colors.textMuted.light;

  return (
    <View style={styles.container}>
      <View
        style={styles.asterism}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View
          style={[
            styles.dot,
            {
              backgroundColor: dotColor,
              left: (ASTERISM_WIDTH - DOT_SIZE) / 2,
              top: 0,
            },
          ]}
        />
        <View
          style={[
            styles.dot,
            { backgroundColor: dotColor, left: 0, bottom: 0 },
          ]}
        />
        <View
          style={[
            styles.dot,
            { backgroundColor: dotColor, right: 0, bottom: 0 },
          ]}
        />
      </View>

      <Text
        style={[
          typography.titleMd,
          { color: titleColor, fontSize: 28, lineHeight: 32 },
        ]}
        numberOfLines={1}
      >
        Settings
      </Text>
      <Text
        style={[typography.bodySm, { color: subtitleColor, marginTop: 3 }]}
        numberOfLines={1}
      >
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  asterism: {
    width: ASTERISM_WIDTH,
    height: 11,
    marginBottom: 12,
    marginLeft: 2,
    position: "relative",
  },
  dot: {
    position: "absolute",
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});

export default SettingsHeader;
