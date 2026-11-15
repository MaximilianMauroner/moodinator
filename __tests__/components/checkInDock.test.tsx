import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_EMOTIONS } from "@/lib/entrySettings";
import type {
  MoodEntryFieldConfig,
  MoodEntryFormValues,
} from "@/components/entry/moodEntryDraft";
import type { Emotion } from "@db/types";
import { CheckInDock } from "@/components/entry/CheckInDock";

const mocks = vi.hoisted(() => ({
  back: undefined as (() => boolean) | undefined,
  tick: vi.fn(),
}));
vi.mock("react-native", () => ({
  KeyboardAvoidingView: "KeyboardAvoidingView",
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  TextInput: "TextInput",
  ScrollView: "ScrollView",
  Keyboard: { dismiss: vi.fn() },
  BackHandler: {
    addEventListener: (_event: string, back: () => boolean) => {
      mocks.back = back;
      return { remove: vi.fn() };
    },
  },
  Platform: { select: (values: Record<string, unknown>) => values.default },
}));
vi.mock("expo-router", () => ({ useFocusEffect: React.useEffect }));
vi.mock("@/lib/haptics", () => ({ haptics: { tick: mocks.tick } }));
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));
vi.mock("react-native-reanimated", () => ({
  default: { View: "View" },
  useAnimatedStyle: (style: () => unknown) => style(),
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
vi.mock("@/hooks/useColorScheme", () => ({ useColorScheme: () => "light" }));
vi.mock("@/components/HapticTab", () => ({ HapticTab: "Pressable" }));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock("@/components/ui/PrivateModal", () => ({
  PrivateModal: "PrivateModal",
}));
vi.mock("@/components/entry/EmotionPicker", () => ({
  EmotionPicker: "EmotionPicker",
}));

let renderer: ReactTestRenderer;
const onKeep =
  vi.fn<(values: MoodEntryFormValues, onKept: () => void) => Promise<void>>();
const fields = { emotions: true, context: true, energy: true, notes: true };
const custom: Emotion = {
  name: "My feeling",
  category: "neutral",
  energy: "high",
};
const renderDock = (fieldConfig: MoodEntryFieldConfig = fields) => (
  <CheckInDock
    fieldConfig={fieldConfig}
    emotionOptions={[...DEFAULT_EMOTIONS, custom]}
    contextOptions={["Home", "Work", "My place"]}
    onKeep={onKeep}
  />
);
const buttons = () =>
  renderer.root.findAll((node) => node.type === "Pressable");
const button = (label: string) =>
  buttons().find((node) => node.props.accessibilityLabel === label)!;
const moodButton = (mood: number) =>
  buttons().find((node) =>
    node.props.accessibilityLabel?.startsWith(`Mood Rating ${mood} of 10,`),
  )!;
const press = async (label: string) => {
  await act(async () => button(label).props.onPress());
};
const host = (type: string) =>
  renderer.root.findAll((node) => node.type === type)[0]!;
const chooseMood = async (mood: number) => {
  await act(async () => moodButton(mood).props.onPress());
};

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.tick.mockClear();
  onKeep.mockImplementation(async (_values, onKept) => onKept());
  await act(async () => {
    renderer = create(renderDock());
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});

it("shows all 11 labelled moods, reuses the tray, and saves only on Keep with the selected values", async () => {
  for (let mood = 0; mood <= 10; mood++) expect(moodButton(mood)).toBeDefined();
  const preview = renderer.root.findAll(
    (node) => node.type === "Text" && typeof node.props.children === "string" && node.props.children.startsWith("Feelings:"),
  )[0];
  expect(preview.props.children).toContain("Context: Home, Work");
  await chooseMood(6);
  expect(moodButton(0)).toBeUndefined();
  await press("Tired");
  await press("Anxious");
  expect(mocks.tick).toHaveBeenCalledTimes(2);
  await press("Next · Context");
  expect(button("#Home").props.accessibilityState.selected).toBe(false);
  expect(button("#Work").props.accessibilityState.selected).toBe(false);
  await press("#My place");
  await press("Energy & note (optional)");
  await press("Energy 1");
  expect(mocks.tick).toHaveBeenCalledTimes(4);
  await act(async () =>
    host("TextInput").props.onChangeText("  Rest tonight  "),
  );
  await press("Done with details");
  expect(onKeep).not.toHaveBeenCalled();
  await press("Keep Low 6");
  expect(onKeep.mock.calls[0]![0]).toEqual({
    mood: 6,
    emotions: [
      { name: "Tired", category: "neutral" },
      { name: "Anxious", category: "negative" },
    ],
    contextTags: ["My place"],
    energy: 1,
    note: "Rest tonight",
    basedOnEntryId: null,
  });
  expect(moodButton(0)).toBeDefined();
});

it("keeps custom feelings and optional details through Back, Change mood and Android back", async () => {
  await chooseMood(2);
  await press("All feelings");
  expect(host("EmotionPicker").props.options).toContainEqual(custom);
  await act(async () => host("EmotionPicker").props.onChange([custom]));
  await act(async () => host("PrivateModal").props.onRequestClose());
  expect(button("My feeling").props.accessibilityState.selected).toBe(true);
  await press("Next · Context");
  await press("#Home");
  await press("Back");
  expect(button("My feeling").props.accessibilityState.selected).toBe(true);
  await press("Good 2 · Change mood");
  await chooseMood(8);
  expect(button("My feeling").props.accessibilityState.selected).toBe(true);
  await press("Next · Context");
  expect(button("#Home").props.accessibilityState.selected).toBe(true);
  await act(async () => {
    expect(mocks.back!()).toBe(true);
  });
  expect(button("My feeling")).toBeDefined();
  await press("Next · Context");
  await press("Keep Overwhelmed 8");
  expect(onKeep.mock.calls[0]![0]).toMatchObject({
    mood: 8,
    emotions: [custom],
    contextTags: ["Home"],
    energy: null,
  });
});

it("limits feelings to three, supports replacement, and clears without saving", async () => {
  await chooseMood(4);
  for (const label of ["Happy", "Relaxed", "Tired"]) await press(label);
  expect(button("Anxious").props.disabled).toBe(true);
  await press("Happy");
  expect(button("Anxious").props.disabled).toBe(false);
  await press("Anxious");
  await press("Clear");
  expect(moodButton(0)).toBeDefined();
  expect(onKeep).not.toHaveBeenCalled();
});

it("preserves an unsaved draft after a failed save and prevents duplicate Keep", async () => {
  let finish!: () => void;
  onKeep.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await chooseMood(4);
  await press("Next · Context");
  await act(async () => {
    button("Keep Okay 4").props.onPress();
    button("Keep Okay 4").props.onPress();
  });
  expect(onKeep).toHaveBeenCalledTimes(1);
  expect(button("Keep Okay 4").props.disabled).toBe(true);
  await act(async () => finish());
  expect(button("Keep Okay 4").props.disabled).toBe(false);
  await press("Keep Okay 4");
  expect(onKeep).toHaveBeenCalledTimes(2);
  expect(moodButton(0)).toBeDefined();
});

it("respects settings that change during a draft and allows every optional field to stay unanswered", async () => {
  await chooseMood(6);
  await press("Tired");
  await press("Next · Context");
  await press("#Home");
  await press("Energy & note (optional)");
  await press("Energy 3");
  await act(async () => host("TextInput").props.onChangeText("Draft note"));
  await press("Done with details");
  await act(async () =>
    renderer.update(
      renderDock({
        emotions: false,
        context: false,
        energy: false,
        notes: false,
      }),
    ),
  );
  expect(button("#Home")).toBeUndefined();
  expect(button("Energy & note (optional)")).toBeUndefined();
  await press("Keep Low 6");
  expect(onKeep.mock.calls[0]![0]).toEqual({
    mood: 6,
    energy: null,
    emotions: [],
    contextTags: [],
    note: "",
    basedOnEntryId: null,
  });
  await chooseMood(0);
  expect(button("Next · Context")).toBeUndefined();
  await press("Keep Elated 0");
  expect(onKeep.mock.calls[1]![0]).toMatchObject({
    mood: 0,
    energy: null,
    emotions: [],
    contextTags: [],
  });
});
