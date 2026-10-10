import React, { useState } from "react";
import { TextInput } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { expect, it, vi } from "vitest";
import { NavigatorHiddenProvider, PrivateModal } from "@/components/ui/PrivateModal";

vi.mock("react-native", () => ({ Modal: "Modal", TextInput: "TextInput" }));

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
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
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
