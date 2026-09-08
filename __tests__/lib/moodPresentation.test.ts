import { describe, test, expect } from "vitest";
import { getMoodHex } from "../../src/lib/moodPresentation";
import { moodScale } from "../../src/constants/moodScale";

describe("getMoodHex", () => {
  // Tracer bullet — verify it reads from moodScale.textHex, not a stale colorMap
  test("returns the textHex from the Mood Scale for a known Mood Rating value", () => {
    const elated = moodScale.find((m) => m.value === 0)!;
    expect(getMoodHex(0)).toBe(elated.textHex);
  });

  test("returns textHexDark when isDark is true", () => {
    const elated = moodScale.find((m) => m.value === 0)!;
    expect(getMoodHex(0, true)).toBe(elated.textHexDark);
  });

  test("light and dark hex values differ for the same Mood Rating", () => {
    expect(getMoodHex(0, false)).not.toBe(getMoodHex(0, true));
  });

  test("returns the neutral fallback hex for a value outside the Mood Scale", () => {
    expect(getMoodHex(99)).toBe("#64748b");
    expect(getMoodHex(-1)).toBe("#64748b");
  });

  test("rounds non-integer values to the nearest Mood Rating", () => {
    const value3 = moodScale.find((m) => m.value === 3)!;
    // 3.4 rounds to 3, 3.6 rounds to 4
    expect(getMoodHex(3.4)).toBe(value3.textHex);
  });
});
