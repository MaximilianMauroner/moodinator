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
  default: { View: "View", Text: "Text" },
  useAnimatedStyle: (style: () => unknown) => style(),
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
  withSpring: (value: number) => value,
  FadeIn: { duration: () => undefined },
  FadeOut: { duration: () => undefined },
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
const byTestId = (testID: string) =>
  renderer.root.findAll((node) => node.props.testID === testID)[0]!;
const moodButton = (mood: number) =>
  buttons().find((node) =>
    node.props.accessibilityLabel?.startsWith(`Mood Rating ${mood} of 10,`),
  )!;
const press = async (label: string) => {
  await act(async () => button(label).props.onPress());
};
const pressTestId = async (testID: string) => {
  await act(async () => byTestId(testID).props.onPress());
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

it("shows all 11 labelled moods, allows inline energy without opening a note sheet, and saves only on Keep", async () => {
  for (let mood = 0; mood <= 10; mood++) expect(moodButton(mood)).toBeDefined();
  const preview = renderer.root.findAll(
    (node) => node.type === "Text" && typeof node.props.children === "string" && node.props.children.startsWith("Feelings:"),
  )[0];
  expect(preview.props.children).toContain("Energy: 0–10");
  expect(preview.props.children).toContain("Context: Home, Work");
  await chooseMood(6);
  expect(moodButton(0)).toBeUndefined();
  await press("Tired");
  await press("Anxious");
  expect(mocks.tick).toHaveBeenCalledTimes(2);
  await press("Next · Energy & context");
  expect(button("#Home").props.accessibilityState.selected).toBe(false);
  expect(button("#Work").props.accessibilityState.selected).toBe(false);
  // Energy is directly selectable inline with no modal open.
  expect(renderer.root.findAll((node) => node.type === "PrivateModal")).toHaveLength(0);
  await pressTestId("energy-level-1");
  expect(byTestId("energy-level-1").props.accessibilityState.selected).toBe(true);
  await press("#My place");
  expect(mocks.tick).toHaveBeenCalledTimes(4);
  // Note lives behind its own dedicated optional trigger and sheet.
  await press("Add a note (optional)");
  expect(renderer.root.findAll((node) => node.type === "PrivateModal")).toHaveLength(1);
  await act(async () =>
    host("TextInput").props.onChangeText("  Rest tonight  "),
  );
  await press("Done with note");
  expect(button("Edit note")).toBeDefined();
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

it("lets users set, toggle, and clear energy inline without any note UI when notes are off", async () => {
  await act(async () => {
    renderer.update(
      renderDock({ emotions: true, context: true, energy: true, notes: false }),
    );
  });
  await chooseMood(3);
  await press("Next · Energy & context");
  expect(byTestId("check-in-note-trigger")).toBeUndefined();
  await pressTestId("energy-level-0");
  expect(byTestId("energy-level-0").props.accessibilityState.selected).toBe(true);
  await pressTestId("energy-level-0");
  expect(byTestId("energy-clear")).toBeUndefined();
  await pressTestId("energy-level-8");
  expect(byTestId("energy-level-8").props.accessibilityState.selected).toBe(true);
  await pressTestId("energy-clear");
  expect(byTestId("energy-level-8").props.accessibilityState.selected).toBe(false);
  await pressTestId("energy-level-7");
  await press("Keep Positive 3");
  expect(onKeep.mock.calls[0]![0]).toMatchObject({
    mood: 3,
    energy: 7,
    note: "",
  });
});

it("keeps custom feelings, inline energy, and context through Back, Change mood and Android back", async () => {
  await chooseMood(2);
  await press("All feelings");
  expect(host("EmotionPicker").props.options).toContainEqual(custom);
  await act(async () => host("EmotionPicker").props.onChange([custom]));
  await act(async () => host("PrivateModal").props.onRequestClose());
  expect(button("My feeling").props.accessibilityState.selected).toBe(true);
  await press("Next · Energy & context");
  await pressTestId("energy-level-6");
  await press("#Home");
  await press("Back");
  expect(button("My feeling").props.accessibilityState.selected).toBe(true);
  expect(button("Energy 6/10 · Change energy")).toBeDefined();
  await press("Good 2 · Change mood");
  await chooseMood(8);
  expect(button("My feeling").props.accessibilityState.selected).toBe(true);
  await press("Next · Energy & context");
  expect(byTestId("energy-level-6").props.accessibilityState.selected).toBe(true);
  expect(button("#Home").props.accessibilityState.selected).toBe(true);
  await act(async () => {
    expect(mocks.back!()).toBe(true);
  });
  expect(button("My feeling")).toBeDefined();
  await press("Next · Energy & context");
  await press("Keep Overwhelmed 8");
  expect(onKeep.mock.calls[0]![0]).toMatchObject({
    mood: 8,
    emotions: [custom],
    contextTags: ["Home"],
    energy: 6,
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
  await press("Next · Energy & context");
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

it("allows clearing a draft note in the note sheet and respects settings that change during a draft", async () => {
  await chooseMood(6);
  await press("Tired");
  await press("Next · Energy & context");
  await press("#Home");
  await pressTestId("energy-level-3");
  await press("Add a note (optional)");
  await act(async () => host("TextInput").props.onChangeText("Draft note"));
  await press("Clear note");
  expect(host("TextInput").props.value).toBe("");
  await act(async () => host("TextInput").props.onChangeText("Kept draft note"));
  await press("Done with note");
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
  expect(byTestId("energy-level-3")).toBeUndefined();
  expect(byTestId("check-in-note-trigger")).toBeUndefined();
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
  expect(byTestId("check-in-next")).toBeUndefined();
  await press("Keep Elated 0");
  expect(onKeep.mock.calls[1]![0]).toMatchObject({
    mood: 0,
    energy: null,
    emotions: [],
    contextTags: [],
  });
});
