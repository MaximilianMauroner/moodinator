import React, { useEffect } from "react";
import { ScrollView, View, Text, useWindowDimensions } from "react-native";
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
  reduceMotion?: boolean;
};

export function OnboardingPage({ page, isActive, reduceMotion = false }: OnboardingPageProps) {
  const { get, isDark } = useThemeColors();
  const { width, height } = useWindowDimensions();
  const compact = height < 700;
  const accentColor = isDark ? page.accentColorDark : page.accentColor;

  // Float animation for the icon
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      translateY.value = 0;
      scale.value = 1;
    } else if (isActive) {
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
  }, [isActive, reduceMotion, translateY, scale]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <ScrollView
      style={{ width }}
      className="flex-1"
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32, paddingVertical: compact ? 16 : 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Icon container with glow effect */}
      <Animated.View style={iconAnimatedStyle}>
        <View
          className={`${compact ? "w-24 h-24 rounded-3xl mb-4" : "w-32 h-32 rounded-[40px] mb-8"} items-center justify-center`}
          style={{
            backgroundColor: `${accentColor}20`,
            shadowColor: accentColor,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.3,
            shadowRadius: 24,
            elevation: 8,
          }}
        >
          <View
            className={`${compact ? "w-16 h-16 rounded-2xl" : "w-24 h-24 rounded-3xl"} items-center justify-center`}
            style={{
              backgroundColor: `${accentColor}30`,
            }}
          >
            <Ionicons
              name={page.icon as keyof typeof Ionicons.glyphMap}
              size={compact ? 36 : 48}
              color={accentColor}
            />
          </View>
        </View>
      </Animated.View>

      {/* Title */}
      <Text
        className={`${compact ? "text-2xl" : "text-3xl"} font-bold text-center mb-2`}
        style={{ color: get("text") }}
      >
        {page.title}
      </Text>

      {/* Subtitle */}
      <Text
        className="text-base font-medium text-center mb-6"
        style={{ color: accentColor }}
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
    </ScrollView>
  );
}
