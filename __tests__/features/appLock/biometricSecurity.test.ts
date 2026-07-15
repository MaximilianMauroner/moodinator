import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  AppState: { addEventListener: vi.fn() },
  Platform: { OS: "android" },
}));

vi.mock("expo-local-authentication", () => ({
  SecurityLevel: { NONE: 0, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
}));

import { isStrongBiometricLevel } from "@/features/appLock/hooks/useBiometrics";

describe("biometric security", () => {
  it("rejects weak Android enrollment but accepts strong Android and iOS enrollment", () => {
    expect(isStrongBiometricLevel("android", 2)).toBe(false);
    expect(isStrongBiometricLevel("android", 3)).toBe(true);
    expect(isStrongBiometricLevel("ios", 2)).toBe(true);
  });
});
