import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CRISIS_SUPPORT_MESSAGE,
  CRISIS_SUPPORT_TITLE,
  requiresCrisisSupportAcknowledgement,
  shouldShowCrisisSupportHint,
} from "../../src/lib/crisisSupport";

const moodEntryModal = readFileSync("src/components/MoodEntryModal.tsx", "utf8");
const crisisFeedbackHandler = moodEntryModal.slice(
  moodEntryModal.indexOf("const indicateCrisisSupportRequirement"),
  moodEntryModal.indexOf("const handlePrimaryAction")
);

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

  it("requires the rating 9 or 10 reminder to be dismissed before continuing", () => {
    expect(requiresCrisisSupportAcknowledgement(8, false)).toBe(false);
    expect(requiresCrisisSupportAcknowledgement(9, false)).toBe(true);
    expect(requiresCrisisSupportAcknowledgement(10, false)).toBe(true);
    expect(requiresCrisisSupportAcknowledgement(9, true)).toBe(false);
  });

  it("renders the guidance inline without post-save alert behavior", () => {
    expect(moodEntryModal).toContain("requiresCrisisSupportAcknowledgement(");
    expect(moodEntryModal).toContain("CRISIS_SUPPORT_MESSAGE");
    expect(moodEntryModal).toContain("Dismiss support reminder");
    expect(moodEntryModal).toContain(
      "Close this reminder with the X to continue."
    );
    expect(moodEntryModal).toContain("disabled={isSaving}");
    expect(moodEntryModal).toContain(
      "onPageScrollStateChanged={handlePageScrollStateChanged}"
    );
    expect(moodEntryModal).toContain(
      'if (scrollState === "dragging")'
    );
    expect(moodEntryModal).toContain(
      "pagerRef.current?.setPageWithoutAnimation(currentStep)"
    );
    expect(moodEntryModal).toContain(
      "scrollEnabled={!isSaving && !isNotesKeyboardActive}"
    );
    expect(moodEntryModal).toContain(
      "crisisSupportScrollViewRef.current?.scrollTo({ y: 0, animated: true })"
    );
    expect(moodEntryModal).toContain(
      "AccessibilityInfo.announceForAccessibility("
    );
    expect(moodEntryModal).toContain("withSequence(");
    expect(crisisFeedbackHandler).toContain("haptics.light()");
    expect(crisisFeedbackHandler).not.toContain("haptics.warning()");
    expect(moodEntryModal).not.toContain("showCrisisSupportAlert");
    expect(moodEntryModal).not.toContain("setTimeout(showCrisisSupport");
  });
});
