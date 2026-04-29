import { describe, test, expect } from "vitest";
import {
  getMoodHex,
  getMoodInterpretation,
  getMoodScaleColor,
  getMoodScaleBg,
  getTrendInterpretation,
} from "../../src/lib/moodPresentation";
import { moodScale } from "../../src/constants/moodScale";

// ---------------------------------------------------------------------------
// getMoodHex
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// getMoodScaleColor / getMoodScaleBg
// ---------------------------------------------------------------------------

describe("getMoodScaleColor and getMoodScaleBg", () => {
  test("returns the Tailwind text class for a known Mood Rating value", () => {
    const neutral = moodScale.find((m) => m.value === 5)!;
    expect(getMoodScaleColor(5)).toBe(neutral.color);
  });

  test("returns the Tailwind bg class for a known Mood Rating value", () => {
    const neutral = moodScale.find((m) => m.value === 5)!;
    expect(getMoodScaleBg(5)).toBe(neutral.bg);
  });

  test("falls back to slate classes for unknown values", () => {
    expect(getMoodScaleColor(99)).toBe("text-slate-500");
    expect(getMoodScaleBg(99)).toBe("bg-slate-100");
  });
});

// ---------------------------------------------------------------------------
// getMoodInterpretation
// ---------------------------------------------------------------------------

describe("getMoodInterpretation", () => {
  // Tracer bullet
  test("returns the Mood Rating Label from the Mood Scale for a known value", () => {
    const neutral = moodScale.find((m) => m.value === 5)!;
    const result = getMoodInterpretation(5);
    expect(result.text).toBe(neutral.label);
  });

  test("returns the correct Tailwind text and bg classes", () => {
    const neutral = moodScale.find((m) => m.value === 5)!;
    const result = getMoodInterpretation(5);
    expect(result.textClass).toBe(neutral.color);
    expect(result.bgClass).toBe(neutral.bg);
  });

  test("rounds fractional Mood Ratings before looking up the label", () => {
    const result = getMoodInterpretation(4.6); // rounds to 5 = Neutral
    expect(result.text).toBe("Neutral");
  });

  test("covers every value on the 0–10 Mood Scale without fallback", () => {
    for (let v = 0; v <= 10; v++) {
      const result = getMoodInterpretation(v);
      const entry = moodScale.find((m) => m.value === v)!;
      expect(result.text).toBe(entry.label);
    }
  });
});

// ---------------------------------------------------------------------------
// getTrendInterpretation
// ---------------------------------------------------------------------------

describe("getTrendInterpretation", () => {
  // Tracer bullet — on the Mood Scale, lower is better, so negative delta = improvement
  test("maps a strongly negative delta to Trending Better", () => {
    const result = getTrendInterpretation(-1);
    expect(result.text).toBe("Trending Better");
  });

  test("maps a mildly negative delta to Improving", () => {
    expect(getTrendInterpretation(-0.2).text).toBe("Improving");
  });

  test("maps a strongly positive delta to Declining", () => {
    expect(getTrendInterpretation(1).text).toBe("Declining");
  });

  test("maps a mildly positive delta to Slight Dip", () => {
    expect(getTrendInterpretation(0.2).text).toBe("Slight Dip");
  });

  test("maps zero delta to Steady", () => {
    expect(getTrendInterpretation(0).text).toBe("Steady");
  });

  test("returns an iconName on every branch", () => {
    const validIcons = [
      "trending-up-outline",
      "arrow-up-outline",
      "trending-down-outline",
      "arrow-down-outline",
      "remove-outline",
    ];
    [-1, -0.2, 0, 0.2, 1].forEach((delta) => {
      expect(validIcons).toContain(getTrendInterpretation(delta).iconName);
    });
  });
});
