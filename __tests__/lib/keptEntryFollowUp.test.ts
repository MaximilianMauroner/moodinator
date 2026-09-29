import { describe, expect, it } from "vitest";

import { getKeptEntryFollowUp } from "@/lib/keptEntryFollowUp";

describe("kept entry follow-up", () => {
  it("puts support first for severe ratings, then keeps detail or Undo", () => {
    expect(getKeptEntryFollowUp(9, true)).toEqual({ supportFirst: true, then: "detail" });
    expect(getKeptEntryFollowUp(10, false)).toEqual({ supportFirst: true, then: "toast" });
  });

  it("goes straight to detail or Undo below the crisis threshold", () => {
    expect(getKeptEntryFollowUp(8, true)).toEqual({ supportFirst: false, then: "detail" });
    expect(getKeptEntryFollowUp(0, false)).toEqual({ supportFirst: false, then: "toast" });
  });
});
