import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useToastOffset, useToastTabBarHeight } from "@/hooks/useToastOffset";

const native = vi.hoisted(() => ({
  platform: "ios",
  height: 844,
  bottom: 34,
  segments: ["(tabs)", "index"],
  keyboardTop: undefined as number | undefined,
  listeners: new Map<string, (event: { endCoordinates: { screenY: number } }) => void>(),
}));
vi.mock("react-native", () => ({
  Platform: { get OS() { return native.platform; } },
  useWindowDimensions: () => ({ height: native.height }),
  Keyboard: {
    metrics: () => native.keyboardTop === undefined ? undefined : { screenY: native.keyboardTop },
    addListener: (name: string, listener: (event: { endCoordinates: { screenY: number } }) => void) => {
      native.listeners.set(name, listener);
      return { remove: () => native.listeners.delete(name) };
    },
  },
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: native.bottom }),
}));
vi.mock("expo-router", () => ({ useSegments: () => native.segments }));


let renderer: ReactTestRenderer;
let offset: number;
function Probe() {
  offset = useToastOffset();
  return null;
}
async function render() {
  await act(async () => { renderer = create(<Probe />); });
}
async function refresh() {
  await act(async () => { renderer.update(<Probe />); });
}
async function keyboard(name: string, screenY = 0) {
  await act(async () => { native.listeners.get(name)?.({ endCoordinates: { screenY } }); });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(native, { platform: "ios", height: 844, bottom: 34, segments: ["(tabs)", "index"], keyboardTop: undefined });
  native.listeners.clear();
  useToastTabBarHeight.setState({ height: 83 });
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); });

describe("toast native boundaries", () => {
  it("uses the measured whole tab bar without adding its safe inset twice", async () => {
    await render();
    expect(offset).toBe(95);
    await act(async () => { useToastTabBarHeight.setState({ height: 100 }); });
    expect(offset).toBe(112);
  });

  it("drops the tab boundary when navigating to a route without tabs", async () => {
    await render();
    native.segments = ["settings", "notifications"];
    await refresh();
    expect(offset).toBe(46);
    native.bottom = 0;
    await refresh();
    expect(offset).toBe(12);
  });

  it("follows iOS keyboard frame changes and returns above tabs after dismissal", async () => {
    await render();
    await keyboard("keyboardWillChangeFrame", 500);
    expect(offset).toBe(356);
    await keyboard("keyboardWillChangeFrame", 600);
    expect(offset).toBe(256);
    await keyboard("keyboardDidHide");
    expect(offset).toBe(95);
  });

  it("does not add the Android keyboard height again after the window resizes", async () => {
    native.platform = "android";
    native.height = 800;
    native.bottom = 24;
    await render();
    await keyboard("keyboardDidShow", 500);
    expect(offset).toBe(312);
    native.height = 500;
    await refresh();
    expect(offset).toBe(95);
    native.segments = ["settings", "notifications"];
    await refresh();
    expect(offset).toBe(36);
  });

  it("reads an already-open keyboard and removes native listeners on unmount", async () => {
    native.keyboardTop = 500;
    await render();
    expect(offset).toBe(356);
    expect(native.listeners.size).toBe(2);
    await act(async () => renderer.unmount());
    expect(native.listeners.size).toBe(0);
  });
});
