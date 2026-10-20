import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const lockState = {
    hydrated: true,
    hydrationError: null,
    captureReady: true,
    captureError: null as string | null,
    hydrate: () => {},
    isEnabled: true,
    isLocked: false,
    lock: () => {},
  };
  return { lockState, appStateListener: null as ((state: string) => void) | null };
});

vi.mock("react-native", () => ({
  Modal: "Modal", View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView",
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
  Platform: { select: (values: Record<string, unknown>) => values.ios ?? values.default },
  useWindowDimensions: () => ({ width: 393, height: 851, fontScale: 1 }),
  AccessibilityInfo: { setAccessibilityFocus: vi.fn() },
  findNodeHandle: () => 42,
  AppState: {
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mocks.appStateListener = listener;
      return { remove: vi.fn() };
    },
  },
}));
vi.mock("expo-router", () => ({
  Stack: "Stack",
  useNavigationContainerRef: () => ({ isReady: () => true, addListener: vi.fn() }),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("expo-status-bar", () => ({ StatusBar: "StatusBar" }));
vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: {} } } }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
vi.mock("react-native-gesture-handler", () => ({ GestureHandlerRootView: "GestureHandlerRootView" }));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("@db/backgroundBackup", () => ({ registerBackgroundBackupTask: vi.fn() }));
vi.mock("@/features/appLock", () => ({ LockScreen: "LockScreen", useAppLockStore: () => mocks.lockState }));
vi.mock("@/features/onboarding", () => ({
  OnboardingScreen: "OnboardingScreen",
  useOnboardingStore: () => ({ hydrated: true, hydrate: () => {}, hasCompletedOnboarding: true }),
}));
vi.mock("@/components/ui/AppToaster", () => ({ AppToaster: "AppToaster" }));
vi.mock("@/shared/state/settingsStore", () => ({ useSettingsStore: () => ({ hydrated: true, hydrate: () => {} }) }));
vi.mock("@/hooks/useColorScheme", () => ({ useColorScheme: () => "dark" }));
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));
vi.mock("@/services/bootstrapService", () => ({ runAppBootstrap: () => Promise.resolve({ status: "ready" }) }));
vi.mock("@/hooks/useNotifications", () => ({ startPendingReminderNavigation: vi.fn(), useNotifications: vi.fn() }));
vi.mock("../../src/app/global.css", () => ({}));

import Layout from "@/app/_layout";
import { Alert } from "@/components/ui/AppAlert";

let renderer: ReactTestRenderer;
const alertModal = () => renderer.root.findByType("Modal");
const alertTitles = () =>
  renderer.root.findAllByProps({ accessibilityRole: "header" }).map((node) => node.props.children);

async function rerender() {
  await act(async () => renderer.update(<Layout />));
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  mocks.lockState.isLocked = false;
  mocks.lockState.captureReady = true;
  mocks.lockState.captureError = null;
  mocks.lockState.lock = () => { mocks.lockState.isLocked = true; };
  await act(async () => {
    renderer = create(<Layout />);
  });
});

afterEach(async () => {
  await act(async () => renderer.unmount());
  vi.unstubAllGlobals();
});

describe("root layout app alert behind App Lock", () => {
  it("closes an open alert without its fade while locked and shows it again after unlock", async () => {
    await act(async () => Alert.alert("Delete \"Therapy check-in\"?", "This reminder will stop.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive" },
    ]));
    expect(alertModal().props).toMatchObject({ visible: true, animationType: "fade" });

    await act(async () => mocks.appStateListener?.("background"));
    await rerender();

    expect(alertModal().props).toMatchObject({ visible: false, animationType: "none" });

    mocks.lockState.isLocked = false;
    await rerender();

    expect(alertModal().props).toMatchObject({ visible: true, animationType: "fade" });
    expect(alertTitles()).toEqual(["Delete \"Therapy check-in\"?"]);
  });

  it("hides private windows during capture updates without discarding the alert", async () => {
    await act(async () => Alert.alert("Private reminder", "Saved detail"));
    mocks.lockState.captureReady = false;
    await rerender();
    expect(alertModal().props).toMatchObject({ visible: false, animationType: "none" });

    mocks.lockState.captureReady = true;
    await rerender();
    expect(alertModal().props.visible).toBe(true);
    expect(alertTitles()).toEqual(["Private reminder"]);
  });

  it("shows truthful recovery and keeps alerts hidden after a capture API failure", async () => {
    await act(async () => Alert.alert("Private reminder", "Saved detail"));
    mocks.lockState.captureReady = false;
    mocks.lockState.captureError = "Capture protection could not be applied.";
    await rerender();

    expect(alertModal().props.visible).toBe(false);
    expect(alertTitles()).toContain("App lock needs attention");
    expect(renderer.root.findAllByType("Text").map((node) => node.props.children).join(" "))
      .toContain("Capture protection could not be applied. Your private content remains hidden.");
  });
});
