import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  platform: "android",
  hardware: vi.fn(),
  enrolled: vi.fn(),
  level: vi.fn(),
  types: vi.fn(),
  authenticate: vi.fn(),
  onAppState: undefined as undefined | ((state: string) => void),
}));

vi.mock("react-native", () => ({
  View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView",
  ActivityIndicator: "ActivityIndicator",
  Platform: { get OS() { return native.platform; } },
  AppState: { addEventListener: (_event: string, listener: (state: string) => void) => {
    native.onAppState = listener;
    return { remove: vi.fn() };
  } },
}));
vi.mock("expo-local-authentication", () => ({
  SecurityLevel: { NONE: 0, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  hasHardwareAsync: native.hardware,
  isEnrolledAsync: native.enrolled,
  getEnrolledLevelAsync: native.level,
  supportedAuthenticationTypesAsync: native.types,
  authenticateAsync: native.authenticate,
}));
vi.mock("@/features/appLock", async () => ({
  ...(await import("@/features/appLock/hooks/useBiometrics")),
  useAppLockStore: () => ({ hydrated: true, isEnabled: true, hasPinSet: true, pinLength: 4 }),
}));
vi.mock("@/features/settings/components/SettingsPageHeader", () => ({ SettingsPageHeader: () => null }));
vi.mock("@/features/settings/components/SettingsSection", () => ({
  SettingsSection: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/features/settings/components/SettingRow", () => ({ SettingRow: "SettingRow" }));
vi.mock("@/features/settings/components/ToggleRow", () => ({ ToggleRow: "ToggleRow" }));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
vi.mock("expo-router", () => ({ router: { push: vi.fn() } }));
vi.mock("nativewind", () => ({ useColorScheme: () => ({ colorScheme: "dark" }) }));
vi.mock("@/constants/colors", () => ({ getThemedColor: () => "#000" }));
vi.mock("@/components/ui/AppAlert", () => ({ Alert: { alert: vi.fn() } }));

import { useBiometrics } from "@/features/appLock/hooks/useBiometrics";
import SecuritySettingsScreen from "@/app/settings/security";

let renderer: ReactTestRenderer;
let biometrics: ReturnType<typeof useBiometrics>;
function Probe() {
  biometrics = useBiometrics();
  return null;
}
async function render(element = <Probe />) {
  await act(async () => { renderer = create(element); });
}
const displayedText = () => renderer.root.findAllByType("Text").map((node) => node.children.join("")).join("\n");

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  native.platform = "android";
  native.hardware.mockResolvedValue(true);
  native.enrolled.mockResolvedValue(true);
  native.level.mockResolvedValue(3);
  native.types.mockResolvedValue([1]);
  native.authenticate.mockResolvedValue({ success: true });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.restoreAllMocks();
});

describe("biometric presentation and unchanged authentication eligibility", () => {
  it("uses a generic label when Android hardware exposes several methods", async () => {
    native.types.mockResolvedValue([2, 1]);
    await render();
    expect(biometrics.getBiometricLabel()).toBe("Biometrics");
    expect(biometrics.getBiometricIcon()).toBe("scan");
    expect(biometrics.isAvailable && biometrics.isEnrolled).toBe(true);
    await act(async () => { expect(await biometrics.authenticate()).toBe(true); });
    expect(native.authenticate).toHaveBeenCalledWith({
      promptMessage: "Unlock Moodinator", cancelLabel: "Use PIN",
      disableDeviceFallback: true, fallbackLabel: "Use PIN", biometricsSecurityLevel: "strong",
    });
  });

  it.each([["ios", [2], "Face ID"], ["ios", [1], "Fingerprint"], ["android", [1], "Fingerprint"]] as const)(
    "preserves the %s label for a single supported method %j", async (platform, types, label) => {
      native.platform = platform;
      native.types.mockResolvedValue(types);
      await render();
      expect(biometrics.getBiometricLabel()).toBe(label);
    }
  );

  it("shows enrollment recovery instead of an unsupported hardware claim", async () => {
    native.enrolled.mockResolvedValue(false);
    await render(<SecuritySettingsScreen />);
    expect(displayedText()).toContain("No biometrics enrolled. Set up biometrics in your device settings");
    expect(displayedText()).not.toContain("doesn't support");
    expect(renderer.root.findAllByType("ToggleRow").map((row) => row.props.title)).not.toContain("Use Fingerprint");
  });

  it("rejects weak Android enrollment and explains that the hardware is supported", async () => {
    native.level.mockResolvedValue(2);
    await render();
    expect(biometrics.hasHardware).toBe(true);
    expect(biometrics.hasEnrollment).toBe(true);
    expect(biometrics.isAvailable && biometrics.isEnrolled).toBe(false);
    await act(async () => { expect(await biometrics.authenticate()).toBe(false); });
    expect(native.authenticate).not.toHaveBeenCalled();
    await act(async () => renderer.update(<SecuritySettingsScreen />));
    expect(displayedText()).toContain("Your enrolled biometrics don't meet app unlock requirements");
    expect(displayedText()).not.toContain("No biometrics enrolled");
    expect(displayedText()).not.toContain("doesn't support");
  });

  it("refreshes enrollment after returning from device settings without enabling authentication", async () => {
    await render();
    native.enrolled.mockResolvedValue(false);
    await act(async () => native.onAppState?.("active"));
    expect(biometrics.hasHardware).toBe(true);
    expect(biometrics.hasEnrollment).toBe(false);
    expect(biometrics.isEnrolled).toBe(false);
    await act(async () => { expect(await biometrics.authenticate()).toBe(false); });
    expect(native.authenticate).not.toHaveBeenCalled();
  });

  it("reserves the unsupported message for devices without biometric hardware", async () => {
    native.hardware.mockResolvedValue(false);
    await render(<SecuritySettingsScreen />);
    expect(displayedText()).toContain("Your device doesn't support biometric authentication.");
    expect(native.enrolled).not.toHaveBeenCalled();
  });

  it("does not turn an API failure into an unsupported hardware claim", async () => {
    native.hardware.mockRejectedValue(new Error("Native check failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await render(<SecuritySettingsScreen />);
    expect(displayedText()).toContain("Moodinator couldn't check biometrics");
    expect(displayedText()).not.toContain("doesn't support");
  });
});
