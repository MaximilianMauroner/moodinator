import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import { haptics } from "@/lib/haptics";

type HapticStyle = "selection" | "light" | "medium" | "rigid" | "soft" | "none";

interface HapticTabProps extends BottomTabBarButtonProps {
  hapticStyle?: HapticStyle;
}

const hapticMap: Record<Exclude<HapticStyle, "none">, () => void> = {
  selection: haptics.selection,
  light: haptics.light,
  medium: haptics.medium,
  rigid: haptics.rigid,
  soft: haptics.soft,
};

export function HapticTab({ hapticStyle = "selection", ...props }: HapticTabProps) {
  const triggerHaptic = () => {
    if (hapticStyle === "none") return;
    hapticMap[hapticStyle]();
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
