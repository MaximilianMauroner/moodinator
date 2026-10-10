import React, { useState } from "react";
import { TextInput } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { expect, it, vi } from "vitest";
import { PrivateDateTimePicker } from "@/components/ui/PrivateDateTimePicker";
import { NavigatorHiddenProvider, PrivateModal } from "@/components/ui/PrivateModal";

vi.mock("react-native", () => ({ Modal: "Modal", TextInput: "TextInput" }));
vi.mock("@react-native-community/datetimepicker", () => ({ default: "DateTimePicker" }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function DraftSheet({ visible }: { visible: boolean }) {
  const [draft, setDraft] = useState("");
  return (
    <PrivateModal visible={visible} transparent animationType="slide">
      <TextInput value={draft} onChangeText={setDraft} />
    </PrivateModal>
  );
}

function App({ hidden, sheetVisible = true }: { hidden: boolean; sheetVisible?: boolean }) {
  return (
    <NavigatorHiddenProvider value={hidden}>
      <DraftSheet visible={sheetVisible} />
    </NavigatorHiddenProvider>
  );
}

it("closes an open sheet's native window at once while the navigator is hidden and keeps its draft", async () => {
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(<App hidden={false} />); });
  const modal = () => renderer.root.find((node) => node.type === "Modal");
  const input = () => renderer.root.find((node) => node.type === "TextInput");

  await act(async () => input().props.onChangeText("fabricated private note"));
  expect(modal().props.visible).toBe(true);

  await act(async () => renderer.update(<App hidden />));
  expect(modal().props.visible).toBe(false);
  expect(modal().props.animationType).toBe("none");
  expect(modal().props.transparent).toBe(true);

  await act(async () => renderer.update(<App hidden={false} />));
  expect(modal().props.visible).toBe(true);
  expect(modal().props.animationType).toBe("slide");
  expect(input().props.value).toBe("fabricated private note");

  await act(async () => renderer.update(<App hidden={false} sheetVisible={false} />));
  expect(modal().props.visible).toBe(false);
  await act(async () => renderer.unmount());
});

it("removes a screen's date picker dialog while the navigator is hidden", async () => {
  const value = new Date(2026, 9, 10, 21, 30);
  const screen = (hidden: boolean) => (
    <NavigatorHiddenProvider value={hidden}>
      <PrivateDateTimePicker mode="time" value={value} onChange={() => {}} />
    </NavigatorHiddenProvider>
  );
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(screen(false)); });
  const pickers = () => renderer.root.findAll((node) => node.type === "DateTimePicker");
  expect(pickers()).toHaveLength(1);

  await act(async () => renderer.update(screen(true)));
  expect(pickers()).toHaveLength(0);

  await act(async () => renderer.update(screen(false)));
  expect(pickers()[0].props.value).toBe(value);
  await act(async () => renderer.unmount());
});
