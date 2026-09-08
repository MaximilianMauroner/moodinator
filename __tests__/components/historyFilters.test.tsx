import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { HistoryFilterSheet } from "@/features/history/HistoryFilterSheet";

vi.mock("@/hooks/useEntrySettings", () => ({
  useEntrySettings: () => ({
    emotionOptions: [{ name: "Calm, connected", category: "positive" }],
    contextOptions: ["Work", "Friends, family"],
  }),
}));

const state = vi.hoisted(() => ({ filters: {}, setFilters: vi.fn() }));
vi.mock("@/shared/state/moodsStore", () => ({
  useMoodsStore: (select: (value: typeof state) => unknown) => select(state),
}));
vi.mock("react-native", () => ({
  Modal: "Modal",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: "SafeAreaView",
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
let renderer: ReactTestRenderer;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.filters = {};
  state.setFilters.mockReset();
  await act(async () => {
    renderer = create(<HistoryFilterSheet />);
  });
  await act(async () =>
    renderer.root
      .findByProps({ accessibilityLabel: "Filter history" })
      .props.onPress(),
  );
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});
async function enter(label: string, value: string) {
  await act(async () =>
    renderer.root
      .findByProps({ accessibilityLabel: label })
      .props.onChangeText(value),
  );
}
async function press(text: string) {
  const node = renderer.root
    .findAllByProps({ accessibilityRole: "button" })
    .find((button) =>
      button
        .findAllByType("Text")
        .some((label) => label.props.children === text),
    );
  await act(async () => node!.props.onPress());
}

test("combines Work, mood 7 or worse and this year, then clears filters", async () => {
  await act(async () =>
    renderer.root
      .findByProps({ accessibilityLabel: "Contexts: Work" })
      .props.onPress(),
  );
  await enter("Mood lower bound (0–10)", "7");
  await enter("Note contains", "meeting");
  await press("Use this year");
  await press("Apply filters");
  const year = new Date().getFullYear();
  expect(state.setFilters).toHaveBeenCalledWith({
    contexts: ["Work"],
    minMood: 7,
    text: "meeting",
    startDate: new Date(year, 0, 1).getTime(),
    endDate: new Date(year, 11, 31, 23, 59, 59, 999).getTime(),
  });
  expect(renderer.root.findByType("Modal").props.visible).toBe(false);
  await press("Clear filters");
  expect(state.setFilters).toHaveBeenLastCalledWith({});
});

test("invalid dates and reversed mood bounds keep the sheet open without querying", async () => {
  await enter("From date (YYYY-MM-DD)", "2026-02-30");
  await press("Apply filters");
  expect(state.setFilters).not.toHaveBeenCalled();
  expect(
    renderer.root.findByProps({ accessibilityRole: "alert" }).props.children,
  ).toBe("Enter a valid date.");
  await enter("From date (YYYY-MM-DD)", "");
  await enter("Mood lower bound (0–10)", "9");
  await enter("Mood upper bound (0–10)", "2");
  await press("Apply filters");
  expect(state.setFilters).not.toHaveBeenCalled();
  expect(renderer.root.findByType("Modal").props.visible).toBe(true);
});

test("preset chips and other names preserve commas as part of a single filter", async () => {
  await act(async () =>
    renderer.root
      .findByProps({ accessibilityLabel: "Emotions: Calm, connected" })
      .props.onPress(),
  );
  await act(async () =>
    renderer.root
      .findByProps({ accessibilityLabel: "Contexts: Friends, family" })
      .props.onPress(),
  );
  await enter("Other contexts name", "Old, archived tag");
  await act(async () =>
    renderer.root
      .findByProps({ accessibilityLabel: "Add contexts filter" })
      .props.onPress(),
  );
  await press("Apply filters");
  expect(state.setFilters).toHaveBeenCalledWith({
    emotions: ["Calm, connected"],
    contexts: ["Friends, family", "Old, archived tag"],
  });
});
