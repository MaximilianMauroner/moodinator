import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import { haptics } from "@/lib/haptics";

/**
 * Bottom tab bar button. The selected tab is a value, so switching tabs fires
 * the same level as any other selection change. Ordinary buttons should use a
 * plain Pressable with `haptics.tap()` instead.
 */
export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(event) => {
        haptics.tick();
        props.onPressIn?.(event);
      }}
    />
  );
}
