import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, test, vi } from "vitest";
import { DisplayMoodItem } from "@/components/DisplayMoodItem";
import type { MoodEntry } from "@db/types";

const gestures = vi.hoisted(() => ({ end: undefined as undefined | ((event: { translationX: number }) => void) }));
vi.mock("react-native", () => ({
  View: "View", Text: "Text", Pressable: "Pressable",
  StyleSheet: { create: (value: unknown) => value },
  useWindowDimensions: () => ({ width: 360 }),
}));
vi.mock("react-native-gesture-handler", () => ({
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  Gesture: { Pan: () => {
    const gesture = {
      activeOffsetX: () => gesture, failOffsetY: () => gesture, runOnJS: () => gesture,
      onUpdate: () => gesture, onFinalize: () => gesture,
      onEnd: (end: typeof gestures.end) => { gestures.end = end; return gesture; },
    };
    return gesture;
  } },
}));
vi.mock("react-native-reanimated", async () => {
  const ReactModule = await import("react");
  return {
    default: { View: "AnimatedView" },
    Easing: { in: (value: unknown) => value, cubic: "cubic" },
    runOnJS: (callback: unknown) => callback,
    useAnimatedStyle: (get: () => unknown) => get(),
    useSharedValue: <T,>(initial: T) => {
      const ref = ReactModule.useRef({ value: initial, set(value: T) { this.value = value; } });
      return ref.current;
    },
    withSpring: (value: unknown) => value,
    withTiming: (value: unknown) => value,
  };
});
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
vi.mock("expo-constants", () => ({ default: { expoConfig: {} } }));
vi.mock("@/constants/colors", () => ({
  colors: { background: { dark: "black" }, sand: { text: "gray" }, swipeEdit: { bg: { dark: "green" }, text: { dark: "white" } }, swipeDelete: { bg: { dark: "red" }, text: { dark: "white" } } },
  useThemeColors: () => ({ isDark: true, get: () => "black", getCategoryColors: () => ({ bg: "black", text: "white" }) }),
}));
vi.mock("@/constants/moodScaleInterpretation", () => ({
  getMoodRatingDisplay: () => ({ label: "Good", colorHex: "green", backgroundHex: "black", borderColor: "gray" }),
}));
vi.mock("@/shared/state/settingsStore", () => ({
  useSettingsStore: (select: (state: { historyCardStyle: string }) => unknown) => select({ historyCardStyle: "minimal" }),
}));
vi.mock("@/components/ui/AppAlert", () => ({ Alert: { alert: vi.fn() } }));
vi.mock("@/lib/haptics", () => ({ haptics: { tap: vi.fn() } }));

let renderer: ReactTestRenderer;
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); });

test("a restored entry cannot inherit a recycled row's collapsed delete animation", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const entry: MoodEntry = { id: 1, mood: 2, timestamp: 1000, note: null, emotions: [], contextTags: [], energy: null,
    moodScale: { version: 1, min: 0, max: 10, lowerIsBetter: true }, basedOnEntryId: null };
  const render = (mood: MoodEntry) => <DisplayMoodItem mood={mood} onSwipeableWillOpen={() => {}} swipeThreshold={100} />;
  await act(async () => { renderer = create(render(entry)); });
  await act(async () => { gestures.end?.({ translationX: -100 }); renderer.update(render(entry)); });
  const frame = () => renderer.root.findByProps({ testID: "mood-entry-stable-1000" });
  expect(frame().props.style[1].height).toBe(0);
  expect(frame().props.style[1].opacity).toBe(0);
  await act(async () => renderer.update(render({ ...entry, id: 2 })));
  expect(frame().props.style[1].height).toBeUndefined();
  expect(frame().props.style[1].opacity).toBe(1);
  // A second recycled entry can still be deleted; its pending-action ref is new.
  await act(async () => { gestures.end?.({ translationX: -100 }); renderer.update(render({ ...entry, id: 2 })); });
  expect(frame().props.style[1].opacity).toBe(0);
});
