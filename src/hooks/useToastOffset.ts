import { useEffect, useState } from "react";
import { Keyboard, Platform, useWindowDimensions, type KeyboardEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSegments } from "expo-router";
import { create } from "zustand";

// The native tab background fills the whole bar, including its bottom inset.
export const useToastTabBarHeight = create(() => ({ height: 0 }));

export function useToastOffset() {
  const { height: windowHeight } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const segments = useSegments();
  const tabBarHeight = useToastTabBarHeight((state) => state.height);
  const [keyboardTop, setKeyboardTop] = useState<number | undefined>(
    () => Keyboard.metrics()?.screenY
  );

  useEffect(() => {
    const update = (event: KeyboardEvent) => setKeyboardTop(event.endCoordinates.screenY);
    const change = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow",
      update
    );
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardTop(undefined));
    return () => {
      change.remove();
      hide.remove();
    };
  }, []);

  // Android resize may already end the window at the keyboard. In that case
  // overlap is zero; adding keyboard height again would lift the toast twice.
  const keyboardOverlap = keyboardTop === undefined ? 0 : Math.max(0, windowHeight - keyboardTop);
  const tabBoundary = segments[0] === "(tabs)" ? tabBarHeight : 0;
  // Sonner's explicit offset replaces its automatic safe-area offset.
  return Math.max(bottom, tabBoundary, keyboardOverlap) + 12;
}
