import React, { useCallback } from "react";
import { StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { motion } from "@/constants/motion";

type TabSceneTransitionProps = {
  children: React.ReactNode;
};

export function TabSceneTransition({ children }: TabSceneTransitionProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) {
        opacity.value = 1;
        translateY.value = 0;
        return;
      }

      opacity.value = 0.88;
      translateY.value = 10;
      opacity.value = withTiming(1, {
        duration: motion.duration.normal,
        easing: Easing.out(Easing.cubic),
      });
      translateY.value = withTiming(0, {
        duration: motion.duration.normal,
        easing: Easing.out(Easing.cubic),
      });
    }, [opacity, reduceMotion, translateY])
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[styles.scene, animatedStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
  },
});
