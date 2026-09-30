import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  // React Native's Linking is a class instance whose openURL reads `this`.
  class Linking {
    opened: string[] = [];
    _validateURL(url: string) {
      if (!url) throw new Error("Invalid URL");
    }
    openURL(url: string): Promise<void> {
      this._validateURL(url);
      this.opened.push(url);
      return Promise.resolve();
    }
  }
  return { linking: new Linking(), showSupportSheet: vi.fn() };
});

vi.mock("react-native", () => ({ Linking: mocks.linking }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ regionCode: "US" }] }));
vi.mock("@/components/ui/AppAlert", () => ({ showSupportSheet: mocks.showSupportSheet }));

import { showCrisisSupportAlert } from "@/lib/showCrisisSupportAlert";

describe("showCrisisSupportAlert", () => {
  beforeEach(() => {
    mocks.linking.opened = [];
    mocks.showSupportSheet.mockReset();
  });

  it("opens a support link through the Linking instance", async () => {
    showCrisisSupportAlert();
    const buttons: { text?: string; onPress?: () => void }[] = mocks.showSupportSheet.mock.calls[0]![2];
    const call = buttons.find((button) => button.text?.startsWith("Call"));

    expect(() => call!.onPress!()).not.toThrow();
    await vi.waitFor(() => expect(mocks.linking.opened).toEqual(["tel:988"]));
  });
});
