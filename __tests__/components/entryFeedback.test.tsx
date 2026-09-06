import React, { useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Emotion } from "@db/types";
import { EmotionPicker } from "@/components/entry/EmotionPicker";
import { EnergySlider } from "@/components/entry/EnergySlider";
import { QuickMoodEntryModal } from "@/components/MoodEntryModal";
import { setHapticsEnabled } from "@/lib/haptics";

const nativePlatform = vi.hoisted(() => ({ OS: "ios", Version: 18 }));
const nativeFeedback = vi.hoisted(() => ({
  selectionAsync: vi.fn(async () => {}),
  performAndroidHapticsAsync: vi.fn(async () => {}),
  impactAsync: vi.fn(async () => {}),
}));

vi.mock("expo-haptics", () => ({
  ...nativeFeedback,
  ImpactFeedbackStyle: { Light: "light" },
  AndroidHaptics: { Gesture_End: "gesture-end", Context_Click: "context-click" },
}));
vi.mock("react-native", () => ({
  Modal: "Modal",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  TextInput: "TextInput",
  Keyboard: { addListener: () => ({ remove: () => {} }), dismiss: vi.fn() },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Platform: {
    get OS() { return nativePlatform.OS; },
    get Version() { return nativePlatform.Version; },
    select: (values: Record<string, unknown>) => values[nativePlatform.OS] ?? values.default,
  },
  useColorScheme: () => "dark",
}));
vi.mock("react-native-pager-view", () => ({ default: "PagerView" }));
vi.mock("@react-navigation/elements", () => ({ PlatformPressable: "Pressable" }));
vi.mock("@/components/entry", () => ({ SameAsYesterdayButton: () => null }));
vi.mock("@/components/ui/AppAlert", () => ({ Alert: { alert: vi.fn() } }));
vi.mock("@/lib/showCrisisSupportAlert", () => ({ showCrisisSupportAlert: vi.fn() }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
vi.mock("react-native-reanimated", async () => {
  const { useRef } = await import("react");
  const transition = { duration: () => undefined };
  return {
    default: { View: "AnimatedView", Text: "AnimatedText" },
    useSharedValue: (value: number) => useRef({ value }).current,
    useAnimatedStyle: (style: () => unknown) => style(),
    withSpring: (value: number) => value,
    withTiming: (value: number) => value,
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
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 0; });
  setHapticsEnabled(true);
});

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.unstubAllGlobals();
  setHapticsEnabled(true);
});

describe.each(["android", "ios"])("entry field feedback on %s", (platform) => {
  beforeEach(() => {
    nativePlatform.OS = platform;
    nativePlatform.Version = platform === "android" ? 35 : 18;
  });
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

function EntryModal() {
  return (
    <QuickMoodEntryModal
      visible
      initialMood={4}
      emotionOptions={options}
      contextOptions={["Work", "Family"]}
      fieldConfig={{ emotions: true, context: true, energy: false, notes: false }}
      onClose={() => {}}
      onSubmit={() => {}}
      onCreateEmotion={() => null}
    />
  );
}

function labeledButton(accessibilityLabel: string) {
  return renderer.root.findByProps({ accessibilityLabel });
}

async function pressLabel(accessibilityLabel: string) {
  await act(async () => { labeledButton(accessibilityLabel).props.onPress(); });
}

describe.each(["android", "ios"])("entry modal feedback on %s", (platform) => {
  beforeEach(() => {
    nativePlatform.OS = platform;
    nativePlatform.Version = platform === "android" ? 35 : 18;
  });

  it.each([true, false])("toggles context through the modal with haptics enabled=%s", async (enabled) => {
    setHapticsEnabled(enabled);
    // Strict Mode replays state updaters, so feedback must belong to the press handler.
    await render(<React.StrictMode><EntryModal /></React.StrictMode>);
    expect(nativeFeedback.selectionAsync).not.toHaveBeenCalled();
    await pressLabel("Context: Work, not selected");
    expect(labeledButton("Context: Work, selected").props.accessibilityState.selected).toBe(true);
    expect(nativeFeedback.selectionAsync).toHaveBeenCalledTimes(enabled ? 1 : 0);
    await pressLabel("Context: Work, selected");
    expect(labeledButton("Context: Work, not selected").props.accessibilityState.selected).toBe(false);
    expect(nativeFeedback.selectionAsync).toHaveBeenCalledTimes(enabled ? 2 : 0);
    expect(nativeFeedback.performAndroidHapticsAsync).not.toHaveBeenCalled();
    expect(nativeFeedback.impactAsync).not.toHaveBeenCalled();
  });

  it("only gives category feedback when the category changes", async () => {
    await render(<EntryModal />);
    await pressLabel("Add new emotion");
    await pressLabel("Positive emotion category");
    expect(nativeFeedback.selectionAsync).not.toHaveBeenCalled();
    await pressLabel("Negative emotion category");
    expect(labeledButton("Negative emotion category").props.accessibilityState.selected).toBe(true);
    expect(nativeFeedback.selectionAsync).toHaveBeenCalledTimes(1);
    await pressLabel("Negative emotion category");
    expect(nativeFeedback.selectionAsync).toHaveBeenCalledTimes(1);
    setHapticsEnabled(false);
    await pressLabel("Neutral emotion category");
    expect(labeledButton("Neutral emotion category").props.accessibilityState.selected).toBe(true);
    expect(nativeFeedback.selectionAsync).toHaveBeenCalledTimes(1);
  });
});
