import { afterEach, describe, expect, test, vi } from "vitest";

const hapticMocks = vi.hoisted(() => ({
  impactAsync: vi.fn(() => Promise.resolve()),
  notificationAsync: vi.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: vi.fn(() => Promise.resolve()),
  selectionAsync: vi.fn(() => Promise.resolve()),
}));

vi.mock("expo-haptics", () => ({
  AndroidHaptics: {
    Clock_Tick: "clock-tick",
    Confirm: "confirm",
    Context_Click: "context-click",
    Gesture_Start: "gesture-start",
    Keyboard_Tap: "keyboard-tap",
    Long_Press: "long-press",
    Reject: "reject",
    Segment_Frequent_Tick: "segment-frequent-tick",
    Segment_Tick: "segment-tick",
    Virtual_Key: "virtual-key",
  },
  ImpactFeedbackStyle: {
    Heavy: "heavy",
    Light: "light",
    Medium: "medium",
    Rigid: "rigid",
    Soft: "soft",
  },
  NotificationFeedbackType: {
    Error: "error",
    Success: "success",
    Warning: "warning",
  },
  ...hapticMocks,
}));

async function loadHaptics(
  platform: "android" | "ios" | "web",
  version?: number
) {
  vi.resetModules();
  vi.doMock("react-native", () => ({
    Platform: { OS: platform, Version: version },
  }));

  return import("@/lib/haptics");
}

afterEach(() => {
  vi.doUnmock("react-native");
});

describe("haptics", () => {
  test("exposes exactly four levels", async () => {
    const { haptics } = await loadHaptics("ios");

    expect(Object.keys(haptics).sort()).toEqual([
      "commit",
      "reject",
      "tap",
      "tick",
    ]);
  });

  test("maps each level to one native iOS event", async () => {
    const { haptics } = await loadHaptics("ios");

    haptics.tick();
    haptics.tap();
    haptics.commit();
    haptics.reject();

    expect(hapticMocks.selectionAsync).toHaveBeenCalledTimes(1);
    expect(hapticMocks.impactAsync.mock.calls).toEqual([["light"]]);
    expect(hapticMocks.notificationAsync.mock.calls).toEqual([
      ["success"],
      ["warning"],
    ]);
    expect(hapticMocks.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });

  test("maps each level to Android's semantic haptic engine", async () => {
    const { haptics } = await loadHaptics("android", 35);

    haptics.tap();
    haptics.commit();
    haptics.reject();

    expect(hapticMocks.performAndroidHapticsAsync.mock.calls).toEqual([
      ["context-click"],
      ["confirm"],
      ["reject"],
    ]);
    expect(hapticMocks.impactAsync).not.toHaveBeenCalled();
    expect(hapticMocks.notificationAsync).not.toHaveBeenCalled();
  });

  test.each([29, 35])("tick avoids Android's activity view on API %i", async (version) => {
    const { haptics } = await loadHaptics("android", version);

    haptics.tick();

    expect(hapticMocks.selectionAsync).toHaveBeenCalledTimes(1);
    expect(hapticMocks.performAndroidHapticsAsync).not.toHaveBeenCalled();
    expect(hapticMocks.impactAsync).not.toHaveBeenCalled();
    expect(hapticMocks.notificationAsync).not.toHaveBeenCalled();
  });

  test("falls back to universally available Android feedback below API 30", async () => {
    const { haptics } = await loadHaptics("android", 29);

    haptics.tap();
    haptics.commit();
    haptics.reject();

    expect(hapticMocks.performAndroidHapticsAsync.mock.calls).toEqual([
      ["context-click"],
      ["context-click"],
      ["long-press"],
    ]);
  });

  test("retries a supported fallback when a preferred Android event fails", async () => {
    hapticMocks.performAndroidHapticsAsync.mockRejectedValueOnce(
      new Error("unsupported by device")
    );
    const { haptics } = await loadHaptics("android", 35);

    haptics.commit();
    await Promise.resolve();
    await Promise.resolve();

    expect(hapticMocks.performAndroidHapticsAsync.mock.calls).toEqual([
      ["confirm"],
      ["context-click"],
    ]);
  });

  test.each(["android", "ios"] as const)("honors the in-app preference on %s", async (platform) => {
    const { getHapticsEnabled, haptics, setHapticsEnabled } =
      await loadHaptics(platform, 35);

    setHapticsEnabled(false);
    haptics.tick();
    haptics.reject();

    expect(getHapticsEnabled()).toBe(false);
    expect(hapticMocks.selectionAsync).not.toHaveBeenCalled();
    expect(hapticMocks.notificationAsync).not.toHaveBeenCalled();
    expect(hapticMocks.performAndroidHapticsAsync).not.toHaveBeenCalled();

    setHapticsEnabled(true);
    haptics.tick();

    expect(getHapticsEnabled()).toBe(true);
    expect(hapticMocks.selectionAsync).toHaveBeenCalledTimes(1);
  });

  test.each(["android", "ios"] as const)("isolates native tick failures on %s without a second event", async (platform) => {
    const { haptics } = await loadHaptics(platform, 35);
    hapticMocks.selectionAsync.mockImplementationOnce(() => {
      throw new Error("native module unavailable");
    });
    expect(() => haptics.tick()).not.toThrow();

    hapticMocks.selectionAsync.mockRejectedValueOnce(new Error("native request failed"));
    haptics.tick();
    await Promise.resolve();

    expect(hapticMocks.selectionAsync).toHaveBeenCalledTimes(2);
    expect(hapticMocks.performAndroidHapticsAsync).not.toHaveBeenCalled();
    expect(hapticMocks.impactAsync).not.toHaveBeenCalled();
    expect(hapticMocks.notificationAsync).not.toHaveBeenCalled();
  });

  test("does nothing on unsupported platforms", async () => {
    const { haptics } = await loadHaptics("web");

    haptics.tick();
    haptics.commit();

    expect(hapticMocks.performAndroidHapticsAsync).not.toHaveBeenCalled();
    expect(hapticMocks.notificationAsync).not.toHaveBeenCalled();
    expect(hapticMocks.selectionAsync).not.toHaveBeenCalled();
  });
});
