import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  id: "new", back: vi.fn(), alert: vi.fn(), openSettings: vi.fn(),
  getAllNotifications: vi.fn(), addNotification: vi.fn(), updateNotification: vi.fn(),
}));
vi.mock("react-native", () => ({
  View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView",
  TextInput: "TextInput", Switch: "Switch", ActivityIndicator: "ActivityIndicator",
  KeyboardAvoidingView: "KeyboardAvoidingView", Platform: { OS: "ios" },
  Linking: { openSettings: mocks.openSettings },
}));
vi.mock("expo-router", () => {
  const router = { back: mocks.back };
  return { useRouter: () => router, useLocalSearchParams: () => ({ id: mocks.id }) };
});
vi.mock("@react-native-community/datetimepicker", () => ({ default: "DateTimePicker" }));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
vi.mock("@/components/ui/IconSymbol", () => ({ IconSymbol: "IconSymbol" }));
vi.mock("@/components/ui/AppAlert", () => ({ Alert: { alert: mocks.alert } }));
vi.mock("@/hooks/useNotifications", () => ({
  getAllNotifications: mocks.getAllNotifications,
  addNotification: mocks.addNotification, updateNotification: mocks.updateNotification,
}));
vi.mock("@/constants/colors", () => ({
  useThemeColors: () => ({ isDark: false, get: () => "#000" }), getThemedColor: () => "#000",
}));
vi.mock("@/lib/haptics", () => ({ haptics: { tap: vi.fn(), tick: vi.fn(), commit: vi.fn(), reject: vi.fn() } }));
vi.mock("expo-localization", () => ({
  useLocales: () => [{ languageTag: "en-GB" }], useCalendars: () => [{ uses24hourClock: true }],
}));

import NotificationDetailScreen from "@/app/notifications/[id]";

let renderer: ReactTestRenderer;
const control = (accessibilityLabel: string) => renderer.root.findByProps({ accessibilityLabel });
const choose = async (prefix: string) => {
  const button = renderer.root.findAllByType("Pressable").find((node) => node.props.accessibilityLabel?.startsWith(prefix));
  expect(button).toBeDefined();
  await act(async () => button!.props.onPress());
};

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  mocks.id = "new";
  mocks.getAllNotifications.mockResolvedValue([]);
  mocks.addNotification.mockImplementation(async (input) => ({ ...input, id: "saved", scheduleStatus: input.enabled ? "scheduled" : "disabled" }));
  mocks.updateNotification.mockResolvedValue({ status: "scheduled", notifications: [] });
  mocks.openSettings.mockResolvedValue(undefined);
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); });
async function render() { await act(async () => { renderer = create(<NotificationDetailScreen />); }); }

describe("reminder setup", () => {
  it("opens choices without saving, and canceling a populated draft has no effect", async () => {
    await render();
    expect(renderer.root.findAllByType("TextInput")).toHaveLength(0);
    await choose("Morning,");
    expect(control("Reminder title").props.value).toBe("How are you feeling?");
    expect(control("Reminder message").props.value).toBe("Take a moment to check in with yourself.");
    await act(async () => control("Go back").props.onPress());
    expect(mocks.back).toHaveBeenCalledOnce();
    expect(mocks.addNotification).not.toHaveBeenCalled();
    expect(mocks.updateNotification).not.toHaveBeenCalled();
  });

  it.each([["Morning,", 9, [1, 2, 3, 4, 5, 6, 7]], ["Evening,", 20, [1, 2, 3, 4, 5, 6, 7]], ["Weekdays,", 20, [2, 3, 4, 5, 6]]] as const)(
    "%s only saves its editable values after explicit activation", async (preset, hour, weekdays) => {
      await render();
      await choose(preset);
      expect(mocks.addNotification).not.toHaveBeenCalled();
      await act(async () => control("Reminder message").props.onChangeText("My check-in"));
      await act(async () => control("Save and enable reminder").props.onPress());
      expect(mocks.addNotification).toHaveBeenCalledWith(expect.objectContaining({ hour, minute: 0, weekdays: [...weekdays], body: "My check-in", enabled: true }));
    }
  );

  it("custom accepts an edited time and day selection and can save paused", async () => {
    await render();
    await choose("Custom schedule");
    await act(async () => control("Every day").props.onPress());
    expect(control("Save and enable reminder").props.disabled).toBe(true);
    await act(async () => control("Tuesday").props.onPress());
    expect(control("Tuesday").props.accessibilityState.checked).toBe(true);
    await choose("Choose reminder time");
    await act(async () => renderer.root.findByType("DateTimePicker").props.onChange({ type: "set" }, new Date(2026, 8, 26, 10, 15)));
    await act(async () => control("Reminder active").props.onValueChange(false));
    await act(async () => control("Save paused reminder").props.onPress());
    expect(mocks.addNotification).toHaveBeenCalledWith(expect.objectContaining({ hour: 10, minute: 15, weekdays: [3], enabled: false }));
  });

  it("keeps existing daily values when editing a legacy reminder", async () => {
    mocks.id = "existing";
    mocks.getAllNotifications.mockResolvedValue([{ id: "existing", title: "My title", body: "My message", hour: 7, minute: 45, enabled: false }]);
    await render();
    expect(control("Reminder title").props.value).toBe("My title");
    expect(control("Every day").props.accessibilityState.checked).toBe(true);
    await act(async () => control("Save paused reminder").props.onPress());
    expect(mocks.updateNotification).toHaveBeenCalledWith("existing", expect.objectContaining({ title: "My title", body: "My message", hour: 7, minute: 45, enabled: false, weekdays: [1, 2, 3, 4, 5, 6, 7] }));
  });

  it("creates only once when save is pressed twice before rendering or after a saved warning", async () => {
    let complete!: (value: unknown) => void;
    mocks.addNotification.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    await render();
    await choose("Morning,");
    const save = control("Save and enable reminder").props.onPress;
    await act(async () => { void save(); void save(); });
    expect(mocks.addNotification).toHaveBeenCalledOnce();
    await act(async () => complete({ id: "saved", enabled: true, scheduleStatus: "permission-denied" }));
    await act(async () => control("Save and enable reminder").props.onPress());
    expect(mocks.addNotification).toHaveBeenCalledOnce();
  });

  it("reports denial and offers system settings without pretending it scheduled", async () => {
    mocks.addNotification.mockImplementation(async (input) => ({ ...input, id: "saved", scheduleStatus: "permission-denied" }));
    await render();
    await choose("Evening,");
    await act(async () => control("Save and enable reminder").props.onPress());
    expect(mocks.alert).toHaveBeenCalledWith("Reminder Not Scheduled", expect.any(String), expect.any(Array));
    const actions = mocks.alert.mock.calls[0][2];
    await act(async () => actions.find((action: { text: string }) => action.text === "Open settings").onPress());
    expect(mocks.openSettings).toHaveBeenCalledOnce();
  });
});
