import { describe, expect, test } from "vitest";
import type { Emotion } from "../../../db/types";
import {
  createPresetListModel,
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

  test("createPresetListModel classifies context defaults and custom tags", () => {
    const model = createPresetListModel({
      values: ["Home", "Therapy"],
      defaults: ["Home", "Work"],
      getLabel: (value) => value,
    });

    expect(model.counts).toEqual({
      activeDefaults: 1,
      customCount: 1,
      total: 2,
    });
    expect(model.defaultItems.map((item) => [item.label, item.isActive])).toEqual([
      ["Home", true],
      ["Work", false],
    ]);
    expect(model.customItems.map((item) => item.label)).toEqual(["Therapy"]);
    expect(model.selectAllDefaults()).toEqual(["Home", "Therapy", "Work"]);
    expect(model.clearDefaults()).toEqual(["Therapy"]);
    expect(model.addCustom("therapy")).toMatchObject({
      ok: false,
      reason: "duplicate",
    });
  });

  test("createPresetListModel supports emotion category subsets", () => {
    const emotions: Emotion[] = [
      { name: "Happy", category: "positive" },
      { name: "Flat", category: "neutral" },
    ];
    const positiveDefaults: Emotion[] = [
      { name: "Happy", category: "positive" },
      { name: "Calm", category: "positive" },
    ];
    const model = createPresetListModel({
      values: emotions,
      defaults: positiveDefaults,
      getLabel: (emotion) => emotion.name,
    });

    expect(model.counts).toEqual({
      activeDefaults: 1,
      customCount: 1,
      total: 2,
    });
    expect(model.selectAllDefaults()).toEqual([
      { name: "Happy", category: "positive" },
      { name: "Flat", category: "neutral" },
      { name: "Calm", category: "positive" },
    ]);
    expect(model.removeByLabel("flat")).toEqual([
      { name: "Happy", category: "positive" },
    ]);
  });
});
