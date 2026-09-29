import { describe, expect, it } from "vitest";

import { getKeptEntryFollowUp } from "@/lib/keptEntryFollowUp";

describe("kept entry follow-up", () => {
  it("sends severe ratings to support even when detail is on", () => {
    expect(getKeptEntryFollowUp(9, true)).toBe("support");
    expect(getKeptEntryFollowUp(10, false)).toBe("support");
  });

  it("offers detail below the crisis threshold when a quick field is on", () => {
    expect(getKeptEntryFollowUp(8, true)).toBe("detail");
    expect(getKeptEntryFollowUp(0, true)).toBe("detail");
  });

  it("confirms with a toast when every quick field is off", () => {
    expect(getKeptEntryFollowUp(4, false)).toBe("toast");
  });
});
