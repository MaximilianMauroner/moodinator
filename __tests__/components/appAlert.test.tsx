import React, { StrictMode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Alert, AppAlertProvider } from "@/components/ui/AppAlert";

const nativeFocus = vi.hoisted(() => vi.fn());
const scrollTo = vi.hoisted(() => vi.fn());
const dimensions = vi.hoisted(() => ({ width: 393, height: 851, fontScale: 1 }));
vi.mock("react-native", () => ({
  Modal: "Modal", View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView",
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
  Platform: { select: (values: Record<string, unknown>) => values.android ?? values.default },
  useWindowDimensions: () => dimensions,
  AccessibilityInfo: { setAccessibilityFocus: nativeFocus },
  findNodeHandle: () => 42,
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("@/hooks/useColorScheme", () => ({ useColorScheme: () => "dark" }));
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));

let renderer: ReactTestRenderer;
async function mount(strict = false) {
  await act(async () => {
    renderer = create(strict ? <StrictMode><AppAlertProvider /></StrictMode> : <AppAlertProvider />, {
      createNodeMock: element => element.type === "ScrollView" ? { scrollTo } : null,
    });
  });
}
async function press(label: string) {
  await act(async () => renderer.root.findByProps({ accessibilityLabel: label }).props.onPress());
}
function titles() {
  return renderer.root.findAllByProps({ accessibilityRole: "header" }).map((node) => node.props.children);
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  dimensions.width = 393;
  dimensions.fontScale = 1;
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.unstubAllGlobals();
});

describe("app dialogs", () => {
  it("preserves button order and runs only the selected action", async () => {
    const keep = vi.fn(); const discard = vi.fn(); const dismissed = vi.fn();
    await mount();
    await act(async () => Alert.alert("Discard changes?", "Draft will be lost", [
      { text: "Keep editing", style: "cancel", onPress: keep },
      { text: "Discard", style: "destructive", onPress: discard },
    ], { onDismiss: dismissed }));
    expect(renderer.root.findAllByProps({ accessibilityRole: "button" }).map(n => n.props.accessibilityLabel))
      .toEqual(["Keep editing", "Discard"]);
    await press("Keep editing");
    expect(keep).toHaveBeenCalledOnce();
    expect(discard).not.toHaveBeenCalled();
    expect(dismissed).not.toHaveBeenCalled();
    expect(titles()).toEqual([]);
  });

  it("does not dismiss non-cancelable dialogs on Android Back", async () => {
    await mount();
    await act(async () => Alert.alert("Required decision", "Read this"));
    const modal = renderer.root.findByType("Modal");
    expect(modal.props.animationType).toBe("none");
    await act(async () => modal.props.onRequestClose());
    expect(titles()).toEqual(["Required decision"]);
    expect(renderer.root.findAllByProps({ accessibilityLabel: "Dismiss dialog" })).toHaveLength(0);
    await press("OK");
  });

  it.each(["back", "backdrop"])("dismisses cancelable dialogs through %s once", async method => {
    const dismissed = vi.fn();
    await mount();
    await act(async () => Alert.alert("Optional", undefined, undefined, { cancelable: true, onDismiss: dismissed }));
    if (method === "back") await act(async () => renderer.root.findByType("Modal").props.onRequestClose());
    else await press("Dismiss dialog");
    expect(dismissed).toHaveBeenCalledOnce();
    expect(titles()).toEqual([]);
  });

  it("shows queued dialogs once in order, including under StrictMode", async () => {
    await mount(true);
    await act(async () => {
      Alert.alert("First"); Alert.alert("Second"); Alert.alert("Third");
    });
    for (const title of ["First", "Second", "Third"]) {
      expect(titles()).toEqual([title]);
      await press("OK");
    }
    expect(titles()).toEqual([]);
  });

  it("ignores repeated taps before the dialog unmounts", async () => {
    const selected = vi.fn();
    await mount();
    await act(async () => Alert.alert("Confirm", undefined, [{ text: "Continue", onPress: selected }]));
    const onPress = renderer.root.findByProps({ accessibilityLabel: "Continue" }).props.onPress;
    await act(async () => { onPress(); onPress(); });
    expect(selected).toHaveBeenCalledOnce();
    expect(titles()).toEqual([]);
  });

  it("resets scroll before showing the next queued message", async () => {
    await mount();
    await act(async () => { Alert.alert("First", "Long content ".repeat(100)); Alert.alert("Second", "More content ".repeat(100)); });
    scrollTo.mockClear();
    await press("OK");
    expect(titles()).toEqual(["Second"]);
    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
    await press("OK");
  });

  it("focuses each queued title after native presentation", async () => {
    await mount();
    await act(async () => { Alert.alert("First"); Alert.alert("Second"); });
    await act(async () => renderer.root.findByType("Modal").props.onShow());
    expect(nativeFocus).toHaveBeenCalledTimes(1);
    await press("OK");
    expect(titles()).toEqual(["Second"]);
    expect(nativeFocus).toHaveBeenCalledTimes(2);
    await press("OK");
  });

  it("appends callback alerts behind already queued requests", async () => {
    await mount();
    await act(async () => {
      Alert.alert("First", undefined, [{ text: "Continue", onPress: () => Alert.alert("Third") }]);
      Alert.alert("Second");
    });
    await press("Continue");
    expect(titles()).toEqual(["Second"]);
    await press("OK");
    expect(titles()).toEqual(["Third"]);
    await press("OK");
  });

  it("accepts an alert raised by the previous dialog's callback", async () => {
    await mount();
    await act(async () => Alert.alert("First", undefined, [{ text: "Continue", onPress: () => Alert.alert("Next") }]));
    await press("Continue");
    expect(titles()).toEqual(["Next"]);
    await press("OK");
  });
});
