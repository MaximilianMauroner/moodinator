import { useCallback } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { springs } from "@/constants/motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const DEFAULT_PRESSED_SCALE = 0.97;

/**
 * One press response for every pressable surface.
 *
 * Replaces the mix of per-file `activeOpacity` and inline `pressed` opacity
 * styles, so a settings card and a mood pill answer a touch the same way.
 * Under reduced motion the scale is skipped and the target stays still.
 */
export function usePressAnimation(pressedScale: number = DEFAULT_PRESSED_SCALE) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = useCallback(() => {
    if (reducedMotion) return;
    scale.value = withSpring(pressedScale, springs.snap);
  }, [pressedScale, reducedMotion, scale]);

  const onPressOut = useCallback(() => {
    if (reducedMotion) {
      scale.value = 1;
      return;
    }
    scale.value = withSpring(1, springs.snap);
  }, [reducedMotion, scale]);

  return { animatedStyle, onPressIn, onPressOut };
}

export default usePressAnimation;
