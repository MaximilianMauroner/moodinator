import { useState, useEffect } from "react";
import { AccessibilityInfo } from "react-native";

interface AccessibilitySettings {
  reduceMotion: boolean;
  screenReaderEnabled: boolean;
}

/**
 * Hook that listens for system accessibility settings.
 * Returns current state of reduce motion and screen reader settings.
 */
export function useAccessibilitySettings(): AccessibilitySettings {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);

  useEffect(() => {
    // Get initial values
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    AccessibilityInfo.isScreenReaderEnabled().then(setScreenReaderEnabled);

    // Listen for changes
    const reduceMotionSubscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion
    );
    const screenReaderSubscription = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setScreenReaderEnabled
    );

    return () => {
      reduceMotionSubscription.remove();
      screenReaderSubscription.remove();
    };
  }, []);

  return { reduceMotion, screenReaderEnabled };
}

export default useAccessibilitySettings;
