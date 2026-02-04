import React from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
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
  const animatedStyle = useAnimatedStyle(() => ({
    width: withSpring(isActive ? 24 : 8, { damping: 15 }),
    backgroundColor: isActive ? activeColor : inactiveColor,
  }));

  return (
    <Animated.View
      style={[
        {
          height: 8,
          borderRadius: 4,
        },
        animatedStyle,
      ]}
    />
  );
}
