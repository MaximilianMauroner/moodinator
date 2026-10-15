import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Layout from "../../src/app/_layout";

const mocks = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  hydrate: vi.fn(),
  lock: vi.fn(),
  router: { replace: vi.fn() },
  navigation: { isReady: vi.fn(() => true), addListener: vi.fn() },
}));

vi.mock("react-native", () => ({
  View: "View", Text: "Text", Pressable: "Pressable", ActivityIndicator: "ActivityIndicator",
  AppState: { addEventListener: () => ({ remove: vi.fn() }) },
}));
vi.mock("expo-router", () => ({
  Stack: "Navigator", useRouter: () => mocks.router,
  useNavigationContainerRef: () => mocks.navigation,
}));
vi.mock("expo-status-bar", () => ({ StatusBar: "StatusBar" }));
vi.mock("expo-constants", () => ({ default: {} }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Icon" }));
vi.mock("react-native-gesture-handler", () => ({ GestureHandlerRootView: "GestureRoot" }));
vi.mock("@db/backgroundBackup", () => ({ registerBackgroundBackupTask: vi.fn() }));
vi.mock("@/features/appLock", () => ({
  LockScreen: "LockScreen",
  useAppLockStore: () => ({ hydrated: true, hydrate: mocks.hydrate, lock: mocks.lock, isEnabled: false }),
}));
vi.mock("@/features/onboarding", () => ({
  OnboardingScreen: "OnboardingScreen",
  useOnboardingStore: () => ({ hydrated: true, hydrate: mocks.hydrate, hasCompletedOnboarding: true }),
}));
vi.mock("@/components/ui/AppToaster", () => ({ AppToaster: "Toaster" }));
vi.mock("@/components/ui/AppAlert", () => ({ AppAlertProvider: "Alerts" }));
vi.mock("@/shared/state/settingsStore", () => ({
  useSettingsStore: () => ({ hydrated: true, hydrate: mocks.hydrate }),
}));
vi.mock("@/hooks/useColorScheme", () => ({ useColorScheme: () => "dark" }));
vi.mock("@/services/bootstrapService", () => ({ runAppBootstrap: mocks.bootstrap }));
vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: vi.fn(), startPendingReminderNavigation: vi.fn(),
}));
vi.mock("../../src/app/global.css", () => ({}));

let renderer: ReactTestRenderer;
const navigators = () => renderer.root.findAll((node) => node.type === "Navigator");

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.bootstrap.mockReset();
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.restoreAllMocks();
});

describe("database startup screen gate", () => {
  it("admits no navigator while database startup is pending", async () => {
    let complete!: (result: { status: "ready" }) => void;
    mocks.bootstrap.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    await act(async () => { renderer = create(<Layout />); });
    expect(navigators()).toHaveLength(0);
    await act(async () => complete({ status: "ready" }));
    expect(navigators()).toHaveLength(1);
  });

  it("keeps screens closed after failure and retries opening before admission", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.bootstrap.mockRejectedValueOnce(new Error("Unable to open encrypted data"));
    await act(async () => { renderer = create(<Layout />); });
    expect(navigators()).toHaveLength(0);
    const retry = renderer.root.findByProps({ accessibilityLabel: "Retry opening mood history" });
    let complete!: (result: { status: "ready-with-warning" }) => void;
    mocks.bootstrap.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    await act(async () => retry.props.onPress());
    expect(mocks.bootstrap).toHaveBeenCalledTimes(2);
    expect(navigators()).toHaveLength(0);
    await act(async () => complete({ status: "ready-with-warning" }));
    expect(navigators()).toHaveLength(1);
  });
});
