import React, { StrictMode } from "react";
import { Modal, Pressable } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Alert, AppAlertProvider, showSupportSheet, useModalAlert } from "@/components/ui/AppAlert";
import { colors } from "@/constants/colors";

const exportsMock = vi.hoisted(() => ({
  platform: "ios",
  createExport: vi.fn(),
  share: vi.fn(async () => {}),
  available: vi.fn(async () => true),
  copy: vi.fn(async () => {}),
  permission: vi.fn(async () => ({ granted: true, directoryUri: "content://folder" })),
  write: vi.fn(async () => {}),
}));
vi.mock("@react-native-community/datetimepicker", () => ({ default: "DateTimePicker" }));
vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file://cache/", EncodingType: { UTF8: "utf8" },
  writeAsStringAsync: exportsMock.write, deleteAsync: vi.fn(async () => {}),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: exportsMock.permission,
    createFileAsync: vi.fn(async () => "content://folder/export.json"),
  },
}));
vi.mock("expo-sharing", () => ({ isAvailableAsync: exportsMock.available, shareAsync: exportsMock.share }));
vi.mock("expo-clipboard", () => ({ setStringAsync: exportsMock.copy }));
vi.mock("@/services/dataPortabilityService", () => ({ dataPortabilityService: { createExport: exportsMock.createExport } }));
import { ExportModal } from "@/features/settings/components/ExportModal";

const nativeFocus = vi.hoisted(() => vi.fn());
const scrollTo = vi.hoisted(() => vi.fn());
const dimensions = vi.hoisted(() => ({ width: 393, height: 851, fontScale: 1 }));
vi.mock("react-native", () => ({
  TouchableOpacity: "TouchableOpacity", ActivityIndicator: "ActivityIndicator",
  Modal: "Modal", View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView",
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {}, absoluteFillObject: {} },
  Platform: {
    get OS() { return exportsMock.platform; },
    select: (values: Record<string, unknown>) => values.android ?? values.default,
  },
  useWindowDimensions: () => dimensions,
  AccessibilityInfo: { setAccessibilityFocus: nativeFocus },
  findNodeHandle: () => 42,
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
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

  it("shows the support sheet with the first support action emphasized", async () => {
    const helpline = vi.fn(); const call = vi.fn(); const notNow = vi.fn();
    await mount();
    await act(async () => showSupportSheet("Support is available", "Reach out now.", [
      { text: "Find A Helpline", onPress: helpline },
      { text: "Call 988 (U.S.)", onPress: call },
      { text: "Not now", style: "cancel", onPress: notNow },
    ]));
    const buttons = renderer.root.findAllByProps({ accessibilityRole: "button" });
    expect(buttons.map((node) => node.props.accessibilityLabel))
      .toEqual(["Find A Helpline", "Call 988 (U.S.)", "Not now"]);
    const fills = buttons.map((node) => node.props.style.at(-1).backgroundColor);
    expect(fills[0]).toBe(colors.supportAction.dark);
    expect(fills[1]).not.toBe(colors.supportAction.dark);
    expect(fills[2]).toBe("transparent");
    await press("Find A Helpline");
    expect(helpline).toHaveBeenCalledOnce();
    expect(call).not.toHaveBeenCalled();
    expect(notNow).not.toHaveBeenCalled();
    expect(titles()).toEqual([]);
  });
});

function ModalHarness({ visible = true }: { visible?: boolean }) {
  const { alert, alertView, onRequestClose } = useModalAlert(visible);
  return <Modal visible={visible} onRequestClose={onRequestClose}>
    <Pressable testID="modal-trigger" onPress={() => alert("Local first", undefined, [
      { text: "Next", onPress: () => alert("Local second") },
    ])} />
    {alertView}
  </Modal>;
}

describe("alerts inside native modals", () => {
  it("reuses its owner Modal and queues callback alerts without native presentation", async () => {
    await act(async () => { renderer = create(<ModalHarness />); });
    await act(async () => renderer.root.findByProps({ testID: "modal-trigger" }).props.onPress());
    expect(renderer.root.findAllByType("Modal")).toHaveLength(1);
    expect(titles()).toEqual(["Local first"]);
    await act(async () => renderer.root.findByType("Modal").props.onRequestClose());
    expect(titles()).toEqual(["Local first"]);
    await press("Next");
    expect(titles()).toEqual(["Local second"]);
    await press("OK");
    expect(titles()).toEqual([]);
  });

  it("clears a closed modal's alerts and ignores late callbacks", async () => {
    await act(async () => { renderer = create(<ModalHarness />); });
    const trigger = renderer.root.findByProps({ testID: "modal-trigger" }).props.onPress;
    await act(async () => trigger());
    await act(async () => renderer.update(<ModalHarness visible={false} />));
    await act(async () => trigger());
    await act(async () => renderer.update(<ModalHarness />));
    expect(titles()).toEqual([]);
  });
});

async function mountExport() {
  const onClose = vi.fn();
  exportsMock.platform = "ios";
  exportsMock.available.mockResolvedValue(true);
  exportsMock.createExport.mockResolvedValue({ ok: true, jsonData: "{}", fileName: "export.json" });
  await act(async () => { renderer = create(<ExportModal visible onClose={onClose} />); });
  return onClose;
}

describe("export modal decisions", () => {
  it("keeps the selected range when export consent is canceled", async () => {
    const onClose = await mountExport();
    const custom = renderer.root.findAllByProps({ accessibilityRole: "radio" })[2];
    await act(async () => custom.props.onPress());
    await press("Share JSON");
    expect(renderer.root.findAllByType("Modal")).toHaveLength(1);
    expect(titles()).toContain("Review data export");
    await press("Back and edit");
    expect(renderer.root.findAllByProps({ accessibilityRole: "radio" })[2].props.accessibilityState.selected).toBe(true);
    expect(exportsMock.createExport).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shares only after consent and closes after native sharing completes", async () => {
    const onClose = await mountExport();
    await press("Share JSON");
    expect(exportsMock.share).not.toHaveBeenCalled();
    await press("Create export");
    expect(exportsMock.share).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps clipboard consent and completion inside the modal until acknowledged", async () => {
    const onClose = await mountExport();
    exportsMock.available.mockResolvedValue(false);
    await press("Share JSON");
    await press("Create export");
    expect(titles()).toEqual(["Copy sensitive data?"]);
    expect(exportsMock.copy).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    await press("Copy JSON");
    expect(exportsMock.copy).toHaveBeenCalledWith("{}");
    expect(titles()).toEqual(["Copied"]);
    expect(renderer.root.findAllByType("Modal")).toHaveLength(1);
    await press("OK");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the export open for correction when creation fails", async () => {
    const onClose = await mountExport();
    exportsMock.createExport.mockResolvedValue({ ok: false, title: "No data", message: "Choose another range" });
    await press("Share JSON");
    await press("Create export");
    expect(titles()).toEqual(["No data"]);
    expect(exportsMock.share).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows Android permission denial inside the modal without closing the range", async () => {
    const onClose = await mountExport();
    exportsMock.platform = "android";
    exportsMock.permission.mockResolvedValueOnce({ granted: false, directoryUri: "" });
    await press("Share JSON");
    await press("Create export");
    expect(titles()).toEqual(["Permission Denied"]);
    expect(exportsMock.write).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType("Modal")).toHaveLength(1);
  });
});
