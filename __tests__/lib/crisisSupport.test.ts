import { describe, expect, it, vi } from "vitest";

import {
  CRISIS_SUPPORT_ACTIONS,
  presentCrisisSupportAlert,
  shouldOfferCrisisSupport,
  type CrisisSupportAlertButton,
} from "../../src/lib/crisisSupport";

describe("crisis support", () => {
  it("offers support for ratings 9 and 10 only", () => {
    expect(shouldOfferCrisisSupport(8)).toBe(false);
    expect(shouldOfferCrisisSupport(9)).toBe(true);
    expect(shouldOfferCrisisSupport(10)).toBe(true);
    expect(shouldOfferCrisisSupport(11)).toBe(false);
    expect(shouldOfferCrisisSupport(Number.NaN)).toBe(false);
  });

  it("provides only U.S. 988 call and text actions", () => {
    expect(CRISIS_SUPPORT_ACTIONS).toEqual([
      expect.objectContaining({ id: "call-988", url: "tel:988" }),
      expect.objectContaining({ id: "text-988", url: "sms:988" }),
    ]);
  });

  it.each([
    { label: "Call 988 (U.S.)", url: "tel:988" },
    { label: "Text 988 (U.S.)", url: "sms:988" },
  ])(
    "shows plain emergency and local helpline guidance when $label fails",
    async ({ label, url }) => {
      const showAlert = vi.fn();
      const openUrl = vi
        .fn<(targetUrl: string) => Promise<unknown>>()
        .mockRejectedValueOnce(new Error("link unavailable"));

      presentCrisisSupportAlert({ showAlert, openUrl });
      const initialButtons = showAlert.mock.calls[0][2] as CrisisSupportAlertButton[];
      initialButtons.find((button) => button.text === label)?.onPress?.();

      await vi.waitFor(() => expect(showAlert).toHaveBeenCalledTimes(2));
      expect(showAlert.mock.calls[1][0]).toBe("Unable to open this action");
      expect(showAlert.mock.calls[1][1]).toContain("could not open");
      expect(showAlert.mock.calls[1][1]).toContain("local emergency number");
      expect(showAlert.mock.calls[1][1]).toContain("local crisis helpline");

      const fallbackButtons = showAlert.mock.calls[1][2] as CrisisSupportAlertButton[];
      expect(fallbackButtons).toEqual([{ text: "OK", style: "cancel" }]);
      expect(openUrl).toHaveBeenCalledOnce();
      expect(openUrl).toHaveBeenCalledWith(url);
    }
  );
});
