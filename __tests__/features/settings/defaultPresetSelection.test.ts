import { describe, expect, test } from "vitest";
import type { Emotion } from "../../../db/types";
import {
  hasEmotionPreset,
  hasPresetValue,
  toggleContextPreset,
  toggleEmotionPreset,
} from "../../../src/features/settings/utils/defaultPresetSelection";

describe("defaultPresetSelection", () => {
  test("toggleContextPreset adds a missing default once", () => {
    expect(toggleContextPreset(["Home"], "Work")).toEqual(["Home", "Work"]);
  });

  test("toggleContextPreset removes an existing default case-insensitively", () => {
    expect(toggleContextPreset(["Home", "work"], "Work")).toEqual(["Home"]);
  });

  test("hasPresetValue matches case-insensitively", () => {
    expect(hasPresetValue(["Home", "Outside"], "home")).toBe(true);
  });

  test("toggleEmotionPreset removes an existing default case-insensitively", () => {
    const emotions: Emotion[] = [
      { name: "happy", category: "neutral" },
      { name: "Calm", category: "positive" },
    ];

    expect(
      toggleEmotionPreset(emotions, { name: "Happy", category: "positive" })
    ).toEqual([{ name: "Calm", category: "positive" }]);
  });

  test("toggleEmotionPreset re-adds the canonical default emotion", () => {
    expect(
      toggleEmotionPreset([], { name: "Happy", category: "positive" })
    ).toEqual([{ name: "Happy", category: "positive" }]);
  });

  test("hasEmotionPreset matches case-insensitively", () => {
    expect(
      hasEmotionPreset([{ name: "Happy", category: "positive" }], "happy")
    ).toBe(true);
  });
});
