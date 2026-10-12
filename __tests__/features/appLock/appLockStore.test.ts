import { beforeEach, describe, expect, it, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";

const secure = vi.hoisted(() => ({ values: new Map<string, string>() }));
const capture = vi.hoisted(() => ({ apply: vi.fn<(enabled: boolean) => Promise<void>>(() => Promise.resolve()) }));

vi.mock("@/features/appLock/services/captureProtection", () => ({
  applyAppLockCaptureProtection: capture.apply,
}));

vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "device-only",
  getItemAsync: vi.fn((key: string) => Promise.resolve(secure.values.get(key) ?? null)),
  setItemAsync: vi.fn((key: string, value: string) => {
    secure.values.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((key: string) => {
    secure.values.delete(key);
    return Promise.resolve();
  }),
}));

vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA256" },
  CryptoEncoding: { HEX: "hex" },
  getRandomBytes: vi.fn(() => new Uint8Array(16).fill(1)),
  digestStringAsync: vi.fn((_algorithm: string, value: string) => Promise.resolve(`digest:${value}`)),
}));

import * as SecureStore from "expo-secure-store";
import { useAppLockStore } from "@/features/appLock/store/appLockStore";

describe("appLockStore", () => {
  beforeEach(async () => {
    secure.values.clear();
    await AsyncStorage.clear();
    useAppLockStore.setState({
      hydrated: false,
      hydrationError: null,
      captureReady: false,
      captureError: null,
      isEnabled: false,
      biometricsEnabled: false,
      pinLength: 4,
      isLocked: false,
      failedAttempts: 0,
      lockoutUntil: null,
      hasPinSet: false,
    });
    capture.apply.mockReset();
    capture.apply.mockResolvedValue(undefined);
  });

  it("fails closed and remains retryable when app-lock storage cannot be read", async () => {
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error("storage offline"));

    await useAppLockStore.getState().hydrate();

    expect(useAppLockStore.getState()).toMatchObject({
      hydrated: true,
      isEnabled: true,
      isLocked: true,
      hasPinSet: true,
      hydrationError: "storage offline",
    });

    await useAppLockStore.getState().hydrate();
    expect(useAppLockStore.getState().hydrationError).toBeNull();
  });

  it("hydrates old v2 PINs with the historical four-digit default", async () => {
    secure.values.set("appLockPinHash", "v2$salt$digest:v2:salt:1234");
    await AsyncStorage.setItem("appLockEnabled", "true");

    await useAppLockStore.getState().hydrate();

    expect(useAppLockStore.getState()).toMatchObject({
      hydrationError: null,
      pinLength: 4,
      biometricsEnabled: false,
      isLocked: true,
    });
    expect(await useAppLockStore.getState().attemptPin("1234")).toEqual({ status: "success" });
    expect(secure.values.get("appLockPinHash")).toMatch(/^v3\$4\$/);
  });

  it("removes an orphaned iOS SecureStore PIN after reinstall", async () => {
    secure.values.set("appLockPinHash", "v3$4$salt$digest:v3:4:salt:1234");

    await useAppLockStore.getState().hydrate();

    expect(secure.values.has("appLockPinHash")).toBe(false);
    expect(useAppLockStore.getState()).toMatchObject({
      hydrationError: null,
      hasPinSet: false,
      isEnabled: false,
      isLocked: false,
    });
  });

  it("stores authoritative PIN length in a device-only v3 hash", async () => {
    await useAppLockStore.getState().setPinLength(6);
    await useAppLockStore.getState().setPin("123456");

    expect(secure.values.get("appLockPinHash")).toMatch(/^v3\$6\$/);
    expect(vi.mocked(SecureStore.setItemAsync)).toHaveBeenCalledWith(
      "appLockPinHash",
      expect.any(String),
      { keychainAccessible: "device-only" }
    );
  });

  it("rejects a concurrent PIN attempt while verification is in flight", async () => {
    await useAppLockStore.getState().setPin("1234");
    const hash = secure.values.get("appLockPinHash")!;
    let resolveRead!: (value: string) => void;
    vi.mocked(SecureStore.getItemAsync).mockImplementationOnce(
      () => new Promise<string>((resolve) => { resolveRead = resolve; })
    );

    const firstAttempt = useAppLockStore.getState().attemptPin("1234");
    expect(await useAppLockStore.getState().attemptPin("1234")).toEqual({ status: "busy" });
    resolveRead(hash);
    expect(await firstAttempt).toEqual({ status: "success" });
  });

  it("applies an in-memory lockout when a failed attempt cannot be persisted", async () => {
    await useAppLockStore.getState().setPin("1234");
    vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("disk full"));

    expect(await useAppLockStore.getState().attemptPin("9999")).toEqual({
      status: "error",
      message: "disk full",
    });
    expect(useAppLockStore.getState().failedAttempts).toBe(1);
    expect(useAppLockStore.getState().lockoutUntil).toBeGreaterThan(Date.now());
  });

  it("migrates legacy attempt metadata into one atomic record", async () => {
    secure.values.set("appLockPinHash", "v3$4$salt$digest:v3:4:salt:1234");
    await AsyncStorage.setItem("appLockEnabled", "true");
    await AsyncStorage.setItem("appLockFailedAttempts", "5");
    await AsyncStorage.setItem("appLockLockoutUntil", String(Date.now() + 60_000));

    await useAppLockStore.getState().hydrate();

    expect(useAppLockStore.getState().failedAttempts).toBe(5);
    expect(JSON.parse((await AsyncStorage.getItem("appLockAttemptState"))!)).toMatchObject({
      failedAttempts: 5,
    });
  });

  it("persists failed attempts and lockout in one storage write", async () => {
    await useAppLockStore.getState().setPin("1234");
    vi.mocked(AsyncStorage.setItem).mockClear();

    await useAppLockStore.getState().attemptPin("9999");

    expect(vi.mocked(AsyncStorage.setItem)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(AsyncStorage.setItem)).toHaveBeenCalledWith(
      "appLockAttemptState",
      JSON.stringify({ failedAttempts: 1, lockoutUntil: null })
    );
  });

  it("keeps hydration gated until the persisted enabled policy reaches native capture", async () => {
    secure.values.set("appLockPinHash", "v3$4$salt$digest:v3:4:salt:1234");
    await AsyncStorage.setItem("appLockEnabled", "true");
    let finishCapture!: () => void;
    capture.apply.mockImplementationOnce(() => new Promise<void>((resolve) => { finishCapture = resolve; }));

    const hydration = useAppLockStore.getState().hydrate();
    await vi.waitFor(() => expect(capture.apply).toHaveBeenCalledWith(true));
    expect(useAppLockStore.getState()).toMatchObject({ hydrated: false, captureReady: false });
    finishCapture();
    await hydration;
    useAppLockStore.getState().unlock();

    expect(useAppLockStore.getState()).toMatchObject({ captureReady: true, isEnabled: true, isLocked: false });
    expect(capture.apply).toHaveBeenCalledTimes(1);
  });

  it("releases startup protection when the persisted setting is off", async () => {
    await useAppLockStore.getState().hydrate();
    expect(capture.apply).toHaveBeenCalledWith(false);
    expect(useAppLockStore.getState()).toMatchObject({ captureReady: true, isEnabled: false });
  });

  it("protects capture before persisting App Lock on", async () => {
    useAppLockStore.setState({ hasPinSet: true, hydrated: true, captureReady: true });
    let finishCapture!: () => void;
    capture.apply.mockImplementationOnce(() => new Promise<void>((resolve) => { finishCapture = resolve; }));

    const enabling = useAppLockStore.getState().setEnabled(true);
    await vi.waitFor(() => expect(capture.apply).toHaveBeenCalledWith(true));
    expect(await AsyncStorage.getItem("appLockEnabled")).toBeNull();
    expect(useAppLockStore.getState().captureReady).toBe(false);
    finishCapture();
    await enabling;

    expect(await AsyncStorage.getItem("appLockEnabled")).toBe("true");
    expect(useAppLockStore.getState()).toMatchObject({ isEnabled: true, captureReady: true });
  });

  it("does not claim protection when capture activation fails and can retry hydration", async () => {
    secure.values.set("appLockPinHash", "v3$4$salt$digest:v3:4:salt:1234");
    await AsyncStorage.setItem("appLockEnabled", "true");
    capture.apply.mockRejectedValueOnce(new Error("native unavailable"));

    await useAppLockStore.getState().hydrate();
    expect(useAppLockStore.getState()).toMatchObject({
      captureReady: false, captureError: "Capture protection could not be applied.",
      hydrationError: "native unavailable",
    });
    await useAppLockStore.getState().hydrate();
    expect(useAppLockStore.getState()).toMatchObject({ captureReady: true, captureError: null });
    expect(capture.apply).toHaveBeenCalledTimes(2);
  });

  it("serializes overlapping enabled-setting changes", async () => {
    useAppLockStore.setState({ hasPinSet: true, hydrated: true, captureReady: true });
    let finishCapture!: () => void;
    capture.apply.mockImplementationOnce(() => new Promise<void>((resolve) => { finishCapture = resolve; }));

    const enabling = useAppLockStore.getState().setEnabled(true);
    const disabling = useAppLockStore.getState().setEnabled(false);
    await vi.waitFor(() => expect(capture.apply).toHaveBeenCalledTimes(1));
    finishCapture();
    await Promise.all([enabling, disabling]);

    expect(capture.apply.mock.calls).toEqual([[true], [false]]);
    expect(await AsyncStorage.getItem("appLockEnabled")).toBe("false");
    expect(useAppLockStore.getState()).toMatchObject({ isEnabled: false, captureReady: true });
  });

  it("keeps PIN recovery gated when capture release fails during PIN removal", async () => {
    const pinHash = "v3$4$salt$digest:v3:4:salt:1234";
    secure.values.set("appLockPinHash", pinHash);
    await AsyncStorage.setItem("appLockEnabled", "true");
    useAppLockStore.setState({ hasPinSet: true, isEnabled: true, hydrated: true, captureReady: true });
    capture.apply.mockRejectedValueOnce(new Error("native unavailable"));

    await expect(useAppLockStore.getState().clearPin()).rejects.toThrow("native unavailable");
    expect(secure.values.get("appLockPinHash")).toBe(pinHash);
    expect(await AsyncStorage.getItem("appLockEnabled")).toBe("true");
    expect(useAppLockStore.getState()).toMatchObject({ isEnabled: true, captureReady: false });
  });

  it.each([false, true])("preserves background locking during capture activation (previous enabled: %s)", async (wasEnabled) => {
    useAppLockStore.setState({
      hasPinSet: true, hydrated: true, captureReady: true, isEnabled: wasEnabled, isLocked: false,
    });
    let finishCapture!: () => void;
    capture.apply.mockImplementationOnce(() => new Promise<void>((resolve) => { finishCapture = resolve; }));

    const enabling = useAppLockStore.getState().setEnabled(true);
    await vi.waitFor(() => expect(capture.apply).toHaveBeenCalledWith(true));
    useAppLockStore.getState().lock();
    finishCapture();
    await enabling;

    expect(useAppLockStore.getState()).toMatchObject({ isEnabled: true, isLocked: true, captureReady: true });
  });
});
