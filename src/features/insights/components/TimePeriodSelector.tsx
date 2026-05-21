import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

export type TimePeriod = "week" | "month" | "all";

interface TimePeriodSelectorProps {
  value: TimePeriod;
  onChange: (period: TimePeriod) => void;
}

const periods: { id: TimePeriod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "week", label: "Week", icon: "calendar-outline" },
  { id: "month", label: "Month", icon: "calendar-number-outline" },
  { id: "all", label: "All", icon: "infinite-outline" },
];

export function TimePeriodSelector({ value, onChange }: TimePeriodSelectorProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [trackWidth, setTrackWidth] = useState(0);
  const segmentWidth = trackWidth / periods.length;
  const activeIndex = periods.findIndex((p) => p.id === value);

  const translateX = useSharedValue(0);

  useEffect(() => {
    translateX.value = withTiming(activeIndex * segmentWidth, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeIndex, segmentWidth, translateX]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: segmentWidth,
  }));

  const onTrackLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      className="mx-4 mb-4 rounded-2xl p-1.5 flex-row"
      style={[
        {
          backgroundColor: isDark ? "#364C44" : "#F5F1E8",
        },
        isDark ? styles.containerShadowDark : styles.containerShadowLight,
      ]}
      onLayout={onTrackLayout}
    >
      {trackWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 6,
              bottom: 6,
              left: 6,
              borderRadius: 12,
              backgroundColor: isDark ? "#1E1B17" : "#FDFCFA",
            },
            isDark ? styles.activeShadowDark : styles.activeShadowLight,
            pillStyle,
          ]}
        />
      )}
      {periods.map((period) => {
        const isActive = value === period.id;

        return (
          <Pressable
            key={period.id}
            onPress={() => onChange(period.id)}
            className="flex-1 flex-row items-center justify-center py-3 rounded-xl"
            style={({ pressed }) => [pressed ? { opacity: 0.8 } : null]}
            accessibilityRole="tab"
            accessibilityLabel={`${period.label} view`}
            accessibilityState={{ selected: isActive }}
          >
            <Ionicons
              name={period.icon}
              size={16}
              color={
                isActive
                  ? isDark
                    ? "#A8C5A8"
                    : "#5B8A5B"
                  : isDark
                  ? "#9FB39A"
                  : "#BDA77D"
              }
              style={{ marginRight: 6 }}
            />
            <Text
              className="text-sm font-semibold"
              style={{
                color: isActive
                  ? isDark
                    ? "#A8C5A8"
                    : "#5B8A5B"
                  : isDark
                  ? "#9FB39A"
                  : "#BDA77D",
              }}
            >
              {period.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  containerShadowLight: {
    shadowColor: "#9D8660",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  containerShadowDark: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  activeShadowLight: {
    shadowColor: "#9D8660",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  activeShadowDark: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
});
