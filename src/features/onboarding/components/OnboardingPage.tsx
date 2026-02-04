import React, { useEffect } from "react";
import { View, Text, useWindowDimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/constants/colors";
import type { OnboardingPage as OnboardingPageType } from "../content";

type OnboardingPageProps = {
  page: OnboardingPageType;
  isActive: boolean;
};

export function OnboardingPage({ page, isActive }: OnboardingPageProps) {
  const { get } = useThemeColors();
  const { width } = useWindowDimensions();

  // Float animation for the icon
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      translateY.value = withDelay(
        300,
        withRepeat(
          withSequence(
            withTiming(-10, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        )
      );
      scale.value = withDelay(
        300,
        withTiming(1, { duration: 500 })
      );
    } else {
      scale.value = withTiming(0.9, { duration: 200 });
    }
  }, [isActive, translateY, scale]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View
      style={{ width }}
      className="flex-1 justify-center items-center px-8"
    >
      {/* Icon container with glow effect */}
      <Animated.View style={iconAnimatedStyle}>
        <View
          className="w-32 h-32 rounded-[40px] items-center justify-center mb-8"
          style={{
            backgroundColor: `${page.accentColor}20`,
            shadowColor: page.accentColor,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.3,
            shadowRadius: 24,
            elevation: 8,
          }}
        >
          <View
            className="w-24 h-24 rounded-3xl items-center justify-center"
            style={{
              backgroundColor: `${page.accentColor}30`,
            }}
          >
            <Ionicons
              name={page.icon as keyof typeof Ionicons.glyphMap}
              size={48}
              color={page.accentColor}
            />
          </View>
        </View>
      </Animated.View>

      {/* Title */}
      <Text
        className="text-3xl font-bold text-center mb-2"
        style={{ color: get("text") }}
      >
        {page.title}
      </Text>

      {/* Subtitle */}
      <Text
        className="text-base font-medium text-center mb-6"
        style={{ color: page.accentColor }}
      >
        {page.subtitle}
      </Text>

      {/* Description */}
      <Text
        className="text-base text-center leading-7"
        style={{ color: get("textMuted"), maxWidth: 320 }}
      >
        {page.description}
      </Text>
    </View>
  );
}
