import React, { useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Emotion } from "@db/types";
import { EmotionPicker } from "@/components/entry/EmotionPicker";
import { EnergySlider } from "@/components/entry/EnergySlider";
import { setHapticsEnabled } from "@/lib/haptics";

const nativeFeedback = vi.hoisted(() => ({ selectionAsync: vi.fn(async () => {}) }));

vi.mock("expo-haptics", () => ({
  ...nativeFeedback,
  AndroidHaptics: { Gesture_End: "gesture-end", Context_Click: "context-click" },
}));
vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Platform: { OS: "ios", Version: 18 },
  useColorScheme: () => "dark",
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
vi.mock("react-native-reanimated", async () => {
  const { useRef } = await import("react");
  const transition = { duration: () => undefined };
  return {
    default: { View: "AnimatedView", Text: "AnimatedText" },
    useSharedValue: (value: number) => useRef({ value }).current,
    useAnimatedStyle: (style: () => unknown) => style(),
    withSpring: (value: number) => value,
    FadeIn: transition,
    FadeOut: transition,
  };
});

const options: Emotion[] = [
  { name: "Happy", category: "positive" },
  { name: "Calm", category: "positive" },
  { name: "Hopeful", category: "positive" },
  { name: "Sad", category: "negative" },
];

function EmotionForm() {
  const [selected, setSelected] = useState<Emotion[]>([]);
  return <EmotionPicker options={options} selected={selected} onChange={setSelected} />;
}

function EnergyForm() {
  const [value, setValue] = useState<number | null>(null);
  return <EnergySlider value={value} onChange={setValue} />;
}

let renderer: ReactTestRenderer;

async function render(element: React.ReactElement) {
  await act(async () => { renderer = create(element); });
}

function button(testID: string) {
  return renderer.root.findByProps({ testID });
}

async function press(testID: string) {
  await act(async () => {
    const target = button(testID);
    // Native Pressable suppresses onPress when disabled.
    if (!target.props.disabled) target.props.onPress();
  });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  setHapticsEnabled(true);
});

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  setHapticsEnabled(true);
});

describe("entry field feedback", () => {
  it("selects, deselects, and removes emotions with one feedback event per change", async () => {
    await render(<EmotionForm />);
    await press("emotion-option-Happy");
    expect(button("emotion-option-Happy").props.accessibilityState.selected).toBe(true);
    await press("emotion-option-Happy");
    expect(button("emotion-option-Happy").props.accessibilityState.selected).toBe(false);
    await press("emotion-option-Calm");
    await press("emotion-remove-Calm");
    expect(button("emotion-option-Calm").props.accessibilityState.selected).toBe(false);
    expect(nativeFeedback.selectionAsync).toHaveBeenCalledTimes(4);
  });

  it("blocks a fourth emotion without feedback and permits selection after removal", async () => {
    await render(<EmotionForm />);
    for (const emotion of options.slice(0, 3)) await press(`emotion-option-${emotion.name}`);
    expect(button("emotion-option-Sad").props.disabled).toBe(true);
    await press("emotion-option-Sad");
    expect(button("emotion-option-Sad").props.accessibilityState.selected).toBe(false);
    expect(nativeFeedback.selectionAsync).toHaveBeenCalledTimes(3);
    await press("emotion-remove-Happy");
    await press("emotion-option-Sad");
    expect(button("emotion-option-Sad").props.accessibilityState.selected).toBe(true);
    expect(nativeFeedback.selectionAsync).toHaveBeenCalledTimes(5);
  });

  it("sets energy including zero, toggles it off, and clears it with feedback", async () => {
    await render(<EnergyForm />);
    await press("energy-level-0");
    expect(button("energy-level-0").props.accessibilityState.selected).toBe(true);
    await press("energy-level-0");
    expect(renderer.root.findAllByProps({ testID: "energy-clear" })).toHaveLength(0);
    await press("energy-level-10");
    expect(button("energy-level-10").props.accessibilityState.selected).toBe(true);
    await press("energy-clear");
    expect(button("energy-level-10").props.accessibilityState.selected).toBe(false);
    expect(nativeFeedback.selectionAsync).toHaveBeenCalledTimes(4);
  });

  it("keeps fields usable when haptics are disabled", async () => {
    setHapticsEnabled(false);
    await render(<><EmotionForm /><EnergyForm /></>);
    await press("emotion-option-Happy");
    await press("energy-level-5");
    expect(button("emotion-option-Happy").props.accessibilityState.selected).toBe(true);
    expect(button("energy-level-5").props.accessibilityState.selected).toBe(true);
    await press("emotion-remove-Happy");
    await press("energy-clear");
    expect(button("emotion-option-Happy").props.accessibilityState.selected).toBe(false);
    expect(button("energy-level-5").props.accessibilityState.selected).toBe(false);
    expect(nativeFeedback.selectionAsync).not.toHaveBeenCalled();
  });
});
