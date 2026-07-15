import React, { useEffect, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors, effectColors } from "@/constants/colors";
import { typography } from "@/constants/typography";

export type SegmentedControlItem<T extends string> = {
  id: T;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type SegmentedControlVariant = "surface" | "primary";

interface SegmentedControlProps<T extends string> {
  value: T;
  items: readonly SegmentedControlItem<T>[];
  onChange: (value: T) => void;
  variant?: SegmentedControlVariant;
  padding?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<T extends string>({
  value,
  items,
  onChange,
  variant = "surface",
  padding = 6,
  className = "mx-4 mb-4 rounded-2xl",
  style,
}: SegmentedControlProps<T>) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [trackWidth, setTrackWidth] = useState(0);
  const segmentWidth = trackWidth > 0 ? (trackWidth - padding * 2) / items.length : 0;
  const activeIndex = Math.max(0, items.findIndex((item) => item.id === value));
  const translateX = useSharedValue(padding);

  useEffect(() => {
    translateX.value = withTiming(padding + activeIndex * segmentWidth, {
      duration: variant === "primary" ? 240 : 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeIndex, padding, segmentWidth, translateX, variant]);

  const sliderStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: segmentWidth,
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const palette = getPalette(isDark, variant);

  return (
    <View
      className={className}
      onLayout={handleLayout}
      style={[
        styles.track,
        {
          backgroundColor: palette.trackBg,
          borderColor: palette.trackBorder,
          padding,
        },
        isDark ? styles.trackShadowDark : styles.trackShadowLight,
        style,
      ]}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.slider,
            {
              backgroundColor: palette.sliderBg,
              borderRadius: 12,
              bottom: padding,
              top: padding,
            },
            isDark ? styles.sliderShadowDark : styles.sliderShadowLight,
            sliderStyle,
          ]}
        />
      ) : null}

      {items.map((item) => {
        const isActive = value === item.id;
        const itemColor = isActive ? palette.activeFg : palette.inactiveFg;

        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(item.id)}
            className="flex-1 flex-row items-center justify-center rounded-xl"
            style={({ pressed }) => [
              styles.button,
              pressed ? { opacity: 0.82, transform: [{ scale: 0.99 }] } : null,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${item.label} view`}
          >
            <Ionicons name={item.icon} size={16} color={itemColor} />
            <Text
              className="ml-2"
              style={[
                typography.bodyMd,
                {
                  color: itemColor,
                  fontWeight: "700",
                },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function getPalette(isDark: boolean, variant: SegmentedControlVariant) {
  if (variant === "primary") {
    return {
      trackBg: isDark ? colors.surface.dark : colors.surfaceAlt.light,
      trackBorder: isDark ? "rgba(166, 227, 155, 0.10)" : "rgba(229, 217, 191, 0.7)",
      sliderBg: isDark ? colors.positive.bgSelected.dark : colors.primary.light,
      activeFg: isDark ? colors.textInverse.dark : colors.background.dark,
      inactiveFg: isDark ? colors.textSubtle.dark : colors.textMuted.light,
    };
  }

  return {
    trackBg: isDark ? colors.surfaceElevated.dark : colors.surfaceAlt.light,
    trackBorder: "transparent",
    sliderBg: isDark ? "#1E1B17" : colors.surface.light,
    activeFg: isDark ? colors.primary.dark : colors.positive.textDark.light,
    inactiveFg: isDark ? colors.textSubtle.dark : colors.textMuted.light,
  };
}

const styles = StyleSheet.create({
  track: {
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 48,
    overflow: "hidden",
    position: "relative",
  },
  button: {
    minHeight: 40,
    zIndex: 1,
  },
  slider: {
    left: 0,
    position: "absolute",
  },
  trackShadowLight: {
    elevation: 2,
    shadowColor: effectColors.shadow.light,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  trackShadowDark: {
    elevation: 2,
    shadowColor: effectColors.shadow.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  sliderShadowLight: {
    elevation: 3,
    shadowColor: effectColors.shadow.light,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  sliderShadowDark: {
    elevation: 3,
    shadowColor: effectColors.shadow.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});

export default SegmentedControl;
