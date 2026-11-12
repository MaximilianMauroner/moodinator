import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_EMOTIONS } from "@/lib/entrySettings";
import type { MoodEntryFormValues } from "@/components/entry/moodEntryDraft";
vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  TextInput: "TextInput",
  ScrollView: "ScrollView",
  Keyboard: {
    dismiss: vi.fn(),
  },
  Platform: {
    select: (values: Record<string, unknown>) => values.default,
  },
}));
vi.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));
vi.mock("@/hooks/useColorScheme", () => ({
  useColorScheme: () => "light",
}));
vi.mock("@/components/entry/MoodPad", () => ({
  MoodPad: "MoodPad",
}));
vi.mock("@/components/entry/MoodPadMoreSheet", () => ({
  MoodPadMoreSheet: "MoreSheet",
}));
import { MoodPadDock } from "@/components/entry/MoodPadDock";
let renderer: ReactTestRenderer;
const onKeep =
  vi.fn<(values: MoodEntryFormValues, onKept: () => void) => Promise<void>>();
const host = (type: string) =>
  renderer.root.findAll((node) => node.type === type)[0]!;
const chip = (label: string) =>
  renderer.root.findAll(
    (node) =>
      node.type === "Pressable" && node.props.accessibilityLabel === label,
  )[0]!;
const keepButton = () =>
  renderer.root.findAll(
    (node) =>
      node.type === "Pressable" && node.props.testID === "mood-pad-keep",
  )[0]!;
const fieldConfig = {
  emotions: true,
  context: true,
  energy: true,
  notes: true,
};
beforeEach(async () => {
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  onKeep.mockImplementation(async (_values, onKept) => onKept());
  await act(async () => {
    renderer = create(
      <MoodPadDock
        fieldConfig={fieldConfig}
        emotionOptions={DEFAULT_EMOTIONS}
        contextOptions={["Home", "Work"]}
        latestContext="Work"
        onKeep={onKeep}
      />,
    );
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});
it("saves nothing until Keep and keeps the note and details across view changes", async () => {
  expect(keepButton().props.disabled).toBe(true);
  expect(host("MoodPad").props.draft).toBeNull();
  await act(async () => host("MoodPad").props.onChange(6, 1));
  await act(async () => chip("Tired").props.onPress());
  await act(async () => chip("#Work").props.onPress());
  await act(async () => chip("Note").props.onPress());
  expect(renderer.root.findAll((node) => node.type === "MoodPad")).toHaveLength(
    0,
  );
  await act(async () =>
    host("TextInput").props.onChangeText("  A quiet evening to rest  "),
  );
  await act(async () => chip("More").props.onPress());
  expect(host("MoreSheet").props.visible).toBe(true);
  expect(host("MoreSheet").props.draft.note).toBe(
    "  A quiet evening to rest  ",
  );
  await act(async () =>
    host("MoreSheet").props.dispatch({
      type: "view",
      view: "pad",
    }),
  );
  expect(onKeep).not.toHaveBeenCalled();
  await act(async () => keepButton().props.onPress());
  expect(onKeep).toHaveBeenCalledWith(
    {
      mood: 6,
      energy: 1,
      emotions: [
        {
          name: "Tired",
          category: "neutral",
        },
      ],
      contextTags: ["Work"],
      note: "A quiet evening to rest",
      basedOnEntryId: null,
    },
    expect.any(Function),
  );
  expect(keepButton().props.disabled).toBe(true);
  expect(host("MoodPad").props.draft).toBeNull();
});
it("retains a failed draft, blocks repeated Keep and clears only after commit", async () => {
  let finish!: () => void;
  onKeep.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => host("MoodPad").props.onChange(4, 7));
  await act(async () => {
    keepButton().props.onPress();
    keepButton().props.onPress();
  });
  expect(onKeep).toHaveBeenCalledTimes(1);
  expect(keepButton().props.disabled).toBe(true);
  await act(async () => finish());
  expect(host("MoodPad").props.draft).toMatchObject({
    mood: 4,
    energy: 7,
  });
  expect(keepButton().props.disabled).toBe(false);
  await act(async () => keepButton().props.onPress());
  expect(onKeep).toHaveBeenCalledTimes(2);
  expect(host("MoodPad").props.draft).toBeNull();
});
it("disables other emotions at three, keeps a selected emotion reachable after a drag, and Clear saves nothing", async () => {
  await act(async () => host("MoodPad").props.onChange(0, 1));
  for (const name of ["Content", "Relaxed", "Bored"])
    await act(async () => chip(name).props.onPress());
  await act(async () => host("MoodPad").props.onChange(8, 9));
  expect(chip("Angry").props.disabled).toBe(true);
  expect(chip("Content").props.disabled).toBe(false);
  await act(async () => chip("Content").props.onPress());
  expect(chip("Angry").props.disabled).toBe(false);
  const clear = renderer.root.findAll(
    (node) =>
      node.type === "Pressable" &&
      node.findAll(
        (child) => child.type === "Text" && child.children.includes("Clear"),
      ).length,
  )[0]!;
  await act(async () => clear.props.onPress());
  expect(host("MoodPad").props.draft).toBeNull();
  expect(onKeep).not.toHaveBeenCalled();
});
it("offers only enabled fields and applies the field settings when keeping an existing draft", async () => {
  await act(async () => host("MoodPad").props.onChange(6, 1));
  await act(async () => chip("Note").props.onPress());
  await act(async () => host("TextInput").props.onChangeText("Private draft"));
  await act(async () =>
    renderer.update(
      <MoodPadDock
        fieldConfig={{
          emotions: false,
          context: false,
          energy: true,
          notes: false,
        }}
        emotionOptions={DEFAULT_EMOTIONS}
        contextOptions={["Home"]}
        onKeep={onKeep}
      />,
    ),
  );
  expect(
    renderer.root.findAll(
      (node) =>
        node.type === "Pressable" && node.props.accessibilityLabel === "#Home",
    ),
  ).toHaveLength(0);
  await act(async () => keepButton().props.onPress());
  expect(onKeep.mock.calls[0]![0]).toMatchObject({
    mood: 6,
    energy: 1,
    emotions: [],
    contextTags: [],
    note: "",
  });
});
