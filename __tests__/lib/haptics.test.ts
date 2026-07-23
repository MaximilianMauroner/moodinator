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
  test("uses Android's semantic haptic engine", async () => {
    const { haptics } = await loadHaptics("android", 35);

    haptics.selection();
    haptics.moodLogged();
    haptics.pinDigit();

    expect(hapticMocks.performAndroidHapticsAsync.mock.calls).toEqual([
      ["segment-tick"],
      ["confirm"],
      ["keyboard-tap"],
    ]);
    expect(hapticMocks.impactAsync).not.toHaveBeenCalled();
    expect(hapticMocks.notificationAsync).not.toHaveBeenCalled();
    expect(hapticMocks.selectionAsync).not.toHaveBeenCalled();
  });

  test("falls back to universally available Android feedback", async () => {
    const { haptics } = await loadHaptics("android", 29);

    haptics.selection();
    haptics.moodLogged();
    haptics.swipeThreshold();
    haptics.error();

    expect(hapticMocks.performAndroidHapticsAsync.mock.calls).toEqual([
      ["clock-tick"],
      ["context-click"],
      ["clock-tick"],
      ["long-press"],
    ]);
  });

  test("retries a supported fallback when a preferred Android event fails", async () => {
    hapticMocks.performAndroidHapticsAsync.mockRejectedValueOnce(
      new Error("unsupported by device")
    );
    const { haptics } = await loadHaptics("android", 35);

    haptics.selection();
    await Promise.resolve();
    await Promise.resolve();

    expect(hapticMocks.performAndroidHapticsAsync.mock.calls).toEqual([
      ["segment-tick"],
      ["clock-tick"],
    ]);
  });

  test("uses one native iOS event for each semantic interaction", async () => {
    const { haptics } = await loadHaptics("ios");

    haptics.selection();
    haptics.moodLogged();
    haptics.longPressActivate();

    expect(hapticMocks.selectionAsync).toHaveBeenCalledTimes(1);
    expect(hapticMocks.notificationAsync).toHaveBeenCalledWith("success");
    expect(hapticMocks.impactAsync).toHaveBeenCalledWith("rigid");
    expect(hapticMocks.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });

  test("honors the in-app preference", async () => {
    const { getHapticsEnabled, haptics, setHapticsEnabled } =
      await loadHaptics("ios");

    setHapticsEnabled(false);
    haptics.selection();
    haptics.error();

    expect(getHapticsEnabled()).toBe(false);
    expect(hapticMocks.selectionAsync).not.toHaveBeenCalled();
    expect(hapticMocks.notificationAsync).not.toHaveBeenCalled();

    setHapticsEnabled(true);
    haptics.selection();

    expect(getHapticsEnabled()).toBe(true);
    expect(hapticMocks.selectionAsync).toHaveBeenCalledTimes(1);
  });

  test("does nothing on unsupported platforms", async () => {
    const { haptics } = await loadHaptics("web");

    haptics.selection();
    haptics.success();

    expect(hapticMocks.performAndroidHapticsAsync).not.toHaveBeenCalled();
    expect(hapticMocks.notificationAsync).not.toHaveBeenCalled();
    expect(hapticMocks.selectionAsync).not.toHaveBeenCalled();
  });
});
