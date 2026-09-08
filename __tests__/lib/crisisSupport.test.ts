import { describe, expect, it, vi } from "vitest";

import {
  CRISIS_SUPPORT_ACTIONS,
  FIND_A_HELPLINE_URL,
  getCrisisSupportActions,
  presentCrisisSupportAlert,
  shouldOfferCrisisSupport,
  type CrisisSupportAlertButton,
} from "../../src/lib/crisisSupport";

describe("crisis support", () => {
  it("keeps the US action order and prioritizes international support elsewhere", () => {
    expect(getCrisisSupportActions("US")).toBe(CRISIS_SUPPORT_ACTIONS);
    for (const region of ["DE", "CA", "", null, undefined]) {
      expect(getCrisisSupportActions(region).map((action) => action.id)).toEqual([
        "find-a-helpline", "call-988", "text-988",
      ]);
    }
  });

  it("still offers international support when locale lookup throws", () => {
    const showAlert = vi.fn();
    presentCrisisSupportAlert({
      showAlert,
      openUrl: vi.fn(),
      getRegion: () => { throw new Error("Locale unavailable"); },
    });
    expect(showAlert.mock.calls[0][2][0].text).toBe("Find A Helpline");
  });
  it("offers support for ratings 9 and 10 only", () => {
    expect(shouldOfferCrisisSupport(8)).toBe(false);
    expect(shouldOfferCrisisSupport(9)).toBe(true);
    expect(shouldOfferCrisisSupport(10)).toBe(true);
    expect(shouldOfferCrisisSupport(11)).toBe(false);
    expect(shouldOfferCrisisSupport(Number.NaN)).toBe(false);
  });

  it("provides U.S. 988 call/text and international helpline actions", () => {
    expect(CRISIS_SUPPORT_ACTIONS).toEqual([
      expect.objectContaining({ id: "call-988", url: "tel:988" }),
      expect.objectContaining({ id: "text-988", url: "sms:988" }),
      expect.objectContaining({
        id: "find-a-helpline",
        url: FIND_A_HELPLINE_URL,
      }),
    ]);
    expect(FIND_A_HELPLINE_URL).toBe("https://findahelpline.com/");
  });

  it.each([
    { label: "Call 988 (U.S.)", url: "tel:988" },
    { label: "Text 988 (U.S.)", url: "sms:988" },
  ])(
    "keeps emergency guidance and Find A Helpline when $label fails",
    async ({ label, url }) => {
      const showAlert = vi.fn();
      const openUrl = vi
        .fn<(targetUrl: string) => Promise<unknown>>()
        .mockRejectedValueOnce(new Error("link unavailable"))
        .mockResolvedValue(undefined);

      presentCrisisSupportAlert({ showAlert, openUrl });
      const initialButtons = showAlert.mock.calls[0][2] as CrisisSupportAlertButton[];
      initialButtons.find((button) => button.text === label)?.onPress?.();

      await vi.waitFor(() => expect(showAlert).toHaveBeenCalledTimes(2));
      expect(showAlert.mock.calls[1][1]).toContain("local emergency number");

      const fallbackButtons = showAlert.mock.calls[1][2] as CrisisSupportAlertButton[];
      fallbackButtons.find((button) => button.text === "Find A Helpline")?.onPress?.();

      expect(openUrl).toHaveBeenNthCalledWith(1, url);
      expect(openUrl).toHaveBeenNthCalledWith(2, FIND_A_HELPLINE_URL);
    }
  );
});
