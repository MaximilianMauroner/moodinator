import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ platform: "ios", canOpen: vi.fn(), open: vi.fn(), alert: vi.fn() }));
vi.mock("react-native", () => ({
  View: "View", Text: "Text", ScrollView: "ScrollView",
  StyleSheet: { create: (styles: unknown) => styles },
  Platform: {
    get OS() { return native.platform; },
    select: (options: Record<string, unknown>) => options[native.platform] ?? options.default,
  },
  Linking: { canOpenURL: native.canOpen, openURL: native.open },
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("nativewind", () => ({ useColorScheme: () => ({ colorScheme: "dark" }) }));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("expo-application", () => ({
  nativeApplicationVersion: null,
  nativeBuildVersion: null,
  applicationName: null,
}));
vi.mock("expo-constants", () => ({ default: { expoConfig: {} } }));
vi.mock("@/components/ui/AppAlert", () => ({ Alert: { alert: native.alert } }));
vi.mock("@/components/ui/IconBadge", () => ({ IconBadge: () => null }));
vi.mock("@/features/settings/components/SettingsPageHeader", () => ({ SettingsPageHeader: () => null }));
vi.mock("@/features/settings/components/SettingsSection", () => ({
  SettingsSection: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/features/settings/components/SettingRow", () => ({ SettingRow: "SettingRow" }));

import AboutSettingsScreen from "@/app/settings/about";

let renderer: ReactTestRenderer;
async function rateApp() {
  await act(async () => { renderer = create(<AboutSettingsScreen />); });
  await act(async () => renderer.root.findByProps({ label: "Rate App" }).props.onPress());
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  native.platform = "ios";
  native.canOpen.mockResolvedValue(true);
  native.open.mockResolvedValue(undefined);
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); });

describe("platform rating destinations", () => {
  it("explains missing iOS ratings without offering or opening an Android URL", async () => {
    await rateApp();
    expect(native.alert).toHaveBeenCalledWith("Rate Moodinator", "App Store ratings are not available yet.");
    expect(native.canOpen).not.toHaveBeenCalled();
    expect(native.open).not.toHaveBeenCalled();
  });

  it.each([
    [true, "market://details?id=com.lab4code.moodinator"],
    [false, "https://play.google.com/store/apps/details?id=com.lab4code.moodinator"],
  ] as const)("keeps the Android destination when market support is %s", async (supported, url) => {
    native.platform = "android";
    native.canOpen.mockResolvedValue(supported);
    await rateApp();
    expect(native.open).toHaveBeenCalledWith(url);
    expect(native.alert).not.toHaveBeenCalled();
  });

  it("offers the valid Google Play web destination if Android launching fails", async () => {
    native.platform = "android";
    native.open.mockRejectedValueOnce(new Error("Could not launch store"));
    await rateApp();
    expect(native.alert).toHaveBeenCalledWith("Rate Moodinator", "https://play.google.com/store/apps/details?id=com.lab4code.moodinator");
  });
});
