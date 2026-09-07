import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Tracks the platform "reduce motion" accessibility setting.
 *
 * Callers use this to skip transforms and value reveals. Final values and
 * opacity still appear, so nothing becomes unreadable. Haptics are deliberately
 * not gated on this: they are a separate preference, held in the settings store.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduced(enabled);
      })
      .catch(() => {
        // Platforms without the query keep motion enabled.
      });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

export default useReducedMotion;
