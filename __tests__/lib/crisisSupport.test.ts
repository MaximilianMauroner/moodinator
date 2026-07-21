import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CRISIS_SUPPORT_MESSAGE,
  CRISIS_SUPPORT_TITLE,
  shouldShowCrisisSupportHint,
} from "../../src/lib/crisisSupport";

const moodEntryModal = readFileSync("src/components/MoodEntryModal.tsx", "utf8");

describe("crisis support", () => {
  it("offers support for ratings 9 and 10 only", () => {
    expect(shouldShowCrisisSupportHint(8)).toBe(false);
    expect(shouldShowCrisisSupportHint(9)).toBe(true);
    expect(shouldShowCrisisSupportHint(10)).toBe(true);
    expect(shouldShowCrisisSupportHint(11)).toBe(false);
    expect(shouldShowCrisisSupportHint(Number.NaN)).toBe(false);
  });

  it("uses passive local support guidance without a service or link", () => {
    expect(CRISIS_SUPPORT_TITLE).toBe("If you need support");
    expect(CRISIS_SUPPORT_MESSAGE).toContain("local emergency number");
    expect(CRISIS_SUPPORT_MESSAGE).toContain("local crisis helpline");
    expect(CRISIS_SUPPORT_MESSAGE).not.toMatch(/https?:|988|call us|text us/i);
  });

  it("renders the guidance inline without post-save alert behavior", () => {
    expect(moodEntryModal).toContain("shouldShowCrisisSupportHint(mood)");
    expect(moodEntryModal).toContain("CRISIS_SUPPORT_MESSAGE");
    expect(moodEntryModal).not.toContain("showCrisisSupportAlert");
    expect(moodEntryModal).not.toContain("setTimeout(showCrisisSupport");
  });
});
