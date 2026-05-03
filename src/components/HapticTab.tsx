import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import { Platform, Vibration } from "react-native";

// Lazy-load so the app works in Expo Go (no RNHapticFeedback in the binary).
let _hapticMod: any = null;
function getHaptic() {
  if (!_hapticMod) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      _hapticMod = require("react-native-haptic-feedback");
    }
    catch { _hapticMod = { default: null, HapticFeedbackTypes: {} }; }
  }
  return _hapticMod as { default: any; HapticFeedbackTypes: Record<string, string> };
}

const HapticFeedbackTypes = new Proxy({} as Record<string, string>, {
  get(_t, key: string) { return getHaptic().HapticFeedbackTypes?.[key] ?? key; },
});

type HapticStyle = "selection" | "light" | "medium" | "rigid" | "soft" | "none";

interface HapticTabProps extends BottomTabBarButtonProps {
  hapticStyle?: HapticStyle;
}

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: true,
};

const hapticMap: Record<Exclude<HapticStyle, "none">, string> = {
  selection: HapticFeedbackTypes.selection,
  light: HapticFeedbackTypes.impactLight,
  medium: HapticFeedbackTypes.impactMedium,
  rigid: HapticFeedbackTypes.rigid,
  soft: HapticFeedbackTypes.soft,
};

export function HapticTab({ hapticStyle = "selection", ...props }: HapticTabProps) {
  // Vibration durations for Android (in ms)
  const vibrationDurations: Record<Exclude<HapticStyle, "none">, number> = {
    selection: 10,
    light: 20,
    medium: 40,
    rigid: 30,
    soft: 15,
  };

  const triggerHaptic = () => {
    if (Platform.OS === "web" || hapticStyle === "none") return;

    if (Platform.OS === "android") {
      // Use native Vibration API on Android as it's more reliable
      const duration = vibrationDurations[hapticStyle] || 20;
      Vibration.vibrate(duration);
    } else {
      getHaptic().default?.trigger(hapticMap[hapticStyle], options);
    }
  };

  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        triggerHaptic();
        props.onPressIn?.(ev);
      }}
    />
  );
}
