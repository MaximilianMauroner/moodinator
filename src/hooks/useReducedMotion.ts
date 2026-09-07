import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useReducedMotion as useSystemReducedMotion } from "react-native-reanimated";

/**
 * Tracks the platform "reduce motion" accessibility setting.
 *
 * Callers use this to skip transforms and value reveals. Final values and
 * opacity still appear, so nothing becomes unreadable. Haptics are deliberately
 * not gated on this: they are a separate preference, held in the settings store.
 */
export function useReducedMotion(): boolean {
  // Reanimated exposes the native value captured during app startup, which
  // avoids an accessibility-violating motion-enabled first render while the
  // asynchronous React Native query is still pending.
  const systemReduced = useSystemReducedMotion();
  const [reduced, setReduced] = useState(systemReduced);

  useEffect(() => {
    let active = true;
    let receivedChangeEvent = false;

    const handleChange = (enabled: boolean) => {
      receivedChangeEvent = true;
      setReduced(enabled);
    };

    // Subscribe before querying so a newer event cannot be overwritten by the
    // older snapshot returned from the asynchronous call.
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      handleChange
    );

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active && !receivedChangeEvent) setReduced(enabled);
      })
      .catch(() => {
        // Platforms without the query keep motion enabled.
      });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

export default useReducedMotion;
