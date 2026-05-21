import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useThemeColors } from "@/constants/colors";

type OnboardingPaginationProps = {
  total: number;
  current: number;
};

export function OnboardingPagination({ total, current }: OnboardingPaginationProps) {
  const { get } = useThemeColors();

  return (
    <View className="flex-row justify-center gap-2 py-4">
      {Array.from({ length: total }).map((_, index) => (
        <PaginationDot
          key={index}
          isActive={index === current}
          activeColor={get("primary")}
          inactiveColor={get("border")}
        />
      ))}
    </View>
  );
}

type PaginationDotProps = {
  isActive: boolean;
  activeColor: string;
  inactiveColor: string;
};

function PaginationDot({ isActive, activeColor, inactiveColor }: PaginationDotProps) {
  const scaleX = useSharedValue(isActive ? 2 : 2 / 3);
  const opacity = useSharedValue(isActive ? 1 : 0.85);

  useEffect(() => {
    const config = { duration: 220, easing: Easing.out(Easing.cubic) };
    scaleX.value = withTiming(isActive ? 2 : 2 / 3, config);
    opacity.value = withTiming(isActive ? 1 : 0.85, config);
  }, [isActive, opacity, scaleX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: scaleX.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: 12,
          height: 8,
          borderRadius: 4,
          backgroundColor: isActive ? activeColor : inactiveColor,
        },
        animatedStyle,
      ]}
    />
  );
}
