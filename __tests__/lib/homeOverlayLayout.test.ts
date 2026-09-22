import { describe, expect, test } from "vitest";

import { getHomeJumpButtonBottomOffset } from "@/lib/homeOverlayLayout";

describe("getHomeJumpButtonBottomOffset", () => {
  test("clears an absolute iOS tab bar without counting the safe inset twice", () => {
    expect(
      getHomeJumpButtonBottomOffset({
        platform: "ios",
        tabBarHeight: 83,
        safeAreaBottom: 34,
      })
    ).toBe(61);
  });

  test("uses the scene-edge gap when the navigator shortens the scene", () => {
    expect(
      getHomeJumpButtonBottomOffset({
        platform: "android",
        tabBarHeight: 80,
        safeAreaBottom: 24,
      })
    ).toBe(12);
  });

  test("never moves below the protected edge for incomplete measurements", () => {
    expect(
      getHomeJumpButtonBottomOffset({
        platform: "ios",
        tabBarHeight: 0,
        safeAreaBottom: 34,
      })
    ).toBe(12);
  });
});
