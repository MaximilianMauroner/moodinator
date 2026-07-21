import { describe, expect, it } from "vitest";

import {
  CRISIS_SUPPORT_ACTIONS,
  FIND_A_HELPLINE_URL,
  shouldOfferCrisisSupport,
} from "../../src/lib/crisisSupport";

describe("crisis support", () => {
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
});
