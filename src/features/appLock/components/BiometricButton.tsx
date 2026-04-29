import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
  withDelay,
} from "react-native-reanimated";
import { useThemeColors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";

type BiometricButtonProps = {
  onPress: () => void;
  label: string;
  icon: string;
  disabled?: boolean;
};

export function BiometricButton({ onPress, label, icon, disabled }: BiometricButtonProps) {
  const { isDark, get } = useThemeColors();
  const scale = useSharedValue(1);

  React.useEffect(() => {
    // Subtle pulse animation to draw attention
    scale.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      )
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    haptics.light();
    onPress();
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        className="items-center"
        style={({ pressed }) => ({
          opacity: pressed || disabled ? 0.7 : 1,
        })}
        accessibilityRole="button"
        accessibilityLabel={`Unlock with ${label}`}
      >
        <View
          className="w-20 h-20 rounded-3xl items-center justify-center mb-4"
          style={{
            backgroundColor: isDark ? "rgba(91, 138, 91, 0.2)" : "rgba(91, 138, 91, 0.15)",
            shadowColor: isDark ? "#000" : "#5B8A5B",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.3 : 0.2,
            shadowRadius: 16,
            elevation: 4,
          }}
        >
          <Ionicons
            name={icon as keyof typeof Ionicons.glyphMap}
            size={36}
            color={get("primary")}
          />
        </View>
        <Text
          className="text-base font-semibold"
          style={{ color: get("primary") }}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
