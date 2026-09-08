import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { HistoryFilterSheet } from "@/features/history/HistoryFilterSheet";
import { ActiveFilterChips } from "@/features/history/ActiveFilterChips";
import { datePresetRange } from "@/features/history/filterModel";

const settings = vi.hoisted(() => ({
  emotionOptions: [{ name: "Calm, connected", category: "positive" }] as {
    name: string;
    category: string;
  }[],
  contextOptions: ["Work", "Friends, family"],
}));
vi.mock("@/hooks/useEntrySettings", () => ({
  useEntrySettings: () => settings,
}));

const state = vi.hoisted(() => ({ filters: {}, setFilters: vi.fn() }));
vi.mock("@/shared/state/moodsStore", () => ({
  useMoodsStore: (select: (value: typeof state) => unknown) => select(state),
}));
vi.mock("@/services/moodService", () => ({
  moodService: {
    getEmotionNames: vi.fn(async () => ["Calm, connected", "Retired feeling"]),
    getContextTags: vi.fn(async () => ["Work", "Old, archived tag"]),
  },
}));
vi.mock("@/lib/haptics", () => ({
  haptics: { tick: vi.fn(), tap: vi.fn(), commit: vi.fn(), reject: vi.fn() },
}));
vi.mock("react-native", () => ({
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Modal: "Modal",
  Platform: { OS: "android", select: (options: Record<string, unknown>) => options.default },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
  useColorScheme: () => "dark",
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
vi.mock("@react-native-community/datetimepicker", () => ({ default: "DateTimePicker" }));

let renderer: ReactTestRenderer;

async function openSheet() {
  await act(async () => {
    renderer = create(<HistoryFilterSheet />);
  });
  await act(async () =>
    renderer.root.findByProps({ accessibilityLabel: "Filter history" }).props.onPress()
  );
}

/** The rendered element, skipping the component that passes the label down. */
function hostByLabel(label: string) {
  return renderer.root.find(
    (node) =>
      typeof node.type === "string" && node.props.accessibilityLabel === label
  );
}

async function pressLabel(label: string) {
  await act(async () => hostByLabel(label).props.onPress());
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.filters = {};
  state.setFilters.mockReset();
  settings.emotionOptions = [{ name: "Calm, connected", category: "positive" }];
  settings.contextOptions = ["Work", "Friends, family"];
});

afterEach(async () => {
  await act(async () => renderer.unmount());
});

test("combines a context, a mood range and a date preset in one pass", async () => {
  await openSheet();
  await pressLabel("Contexts: Work");
  await pressLabel("Mood 7, Struggling");
  await pressLabel("Mood 10, Emergency");
  await act(async () =>
    renderer.root
      .findByProps({ accessibilityLabel: "Note contains" })
      .props.onChangeText("meeting")
  );
  await pressLabel("Last 7 days");
  await pressLabel("Apply filters");

  expect(state.setFilters).toHaveBeenCalledWith({
    contexts: ["Work"],
    minMood: 7,
    maxMood: 10,
    text: "meeting",
    ...datePresetRange("7d", new Date()),
  });
  expect(renderer.root.findByType("Modal").props.visible).toBe(false);
});

test("offers names from older entries alongside the current presets", async () => {
  await openSheet();
  await pressLabel("Emotions: Retired feeling");
  await pressLabel("Contexts: Old, archived tag");
  await pressLabel("Apply filters");

  expect(state.setFilters).toHaveBeenCalledWith({
    emotions: ["Retired feeling"],
    contexts: ["Old, archived tag"],
  });
});

test("reopening keeps the saved filters selected and clear empties them", async () => {
  state.filters = { minMood: 4, maxMood: 4, contexts: ["Work"] };
  await openSheet();

  expect(hostByLabel("Contexts: Work").props.accessibilityState.checked).toBe(true);
  expect(hostByLabel("Mood 4, Okay").props.accessibilityState.selected).toBe(true);

  await pressLabel("Clear filters");
  await pressLabel("Apply filters");
  expect(state.setFilters).toHaveBeenCalledWith({});
});

test("a long emotion list collapses behind a count until expanded", async () => {
  const many = Array.from({ length: 30 }, (_, index) => ({
    name: `Feeling ${index}`,
    category: "positive",
  }));
  settings.emotionOptions = many;
  await openSheet();

  // 30 presets plus the two names the mocked service reports from history.
  expect(() => hostByLabel("Emotions: Feeling 25")).toThrow();
  await pressLabel("Show all 32 emotions");
  expect(hostByLabel("Emotions: Feeling 25")).toBeTruthy();

  await pressLabel("Show fewer emotions");
  expect(() => hostByLabel("Emotions: Feeling 25")).toThrow();
});

test("each active chip removes only its own filter", async () => {
  state.filters = { minMood: 7, maxMood: 10, contexts: ["Work", "Friends"] };
  await act(async () => {
    renderer = create(<ActiveFilterChips />);
  });

  await pressLabel("Remove filter Work");
  expect(state.setFilters).toHaveBeenCalledWith({
    minMood: 7,
    maxMood: 10,
    contexts: ["Friends"],
  });

  await pressLabel("Clear all filters");
  expect(state.setFilters).toHaveBeenLastCalledWith({});
});
