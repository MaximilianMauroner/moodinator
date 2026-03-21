import React from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useThemeColors } from "@/constants/colors";

type PinDotsProps = {
  pinLength: 4 | 6;
  enteredLength: number;
  error?: boolean;
};

export function PinDots({ pinLength, enteredLength, error }: PinDotsProps) {
  const { isDark, get } = useThemeColors();

  return (
    <View className="flex-row justify-center gap-4 py-8">
      {Array.from({ length: pinLength }).map((_, index) => (
        <PinDot
          key={index}
          filled={index < enteredLength}
          error={error}
          isDark={isDark}
          primaryColor={get("primary")}
          borderColor={get("border")}
        />
      ))}
    </View>
  );
}

type PinDotProps = {
  filled: boolean;
  error?: boolean;
  isDark: boolean;
  primaryColor: string;
  borderColor: string;
};

function PinDot({ filled, error, isDark, primaryColor, borderColor }: PinDotProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const scale = filled
      ? withSpring(1, { damping: 15, stiffness: 300 })
      : withSpring(0.8, { damping: 15 });

    const translateX = error
      ? withSequence(
          withTiming(-8, { duration: 50 }),
          withTiming(8, { duration: 50 }),
          withTiming(-6, { duration: 50 }),
          withTiming(6, { duration: 50 }),
          withTiming(-4, { duration: 50 }),
          withTiming(4, { duration: 50 }),
          withTiming(0, { duration: 50 })
        )
      : withTiming(0, { duration: 100 });

    return {
      transform: [{ scale }, { translateX }],
    };
  }, [filled, error]);

  const errorColor = isDark ? "#ED8370" : "#E06B55";

  return (
    <Animated.View
      style={[
        {
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: error
            ? errorColor
            : filled
            ? primaryColor
            : "transparent",
          borderWidth: 2,
          borderColor: error ? errorColor : filled ? primaryColor : borderColor,
        },
        animatedStyle,
      ]}
    />
  );
}
