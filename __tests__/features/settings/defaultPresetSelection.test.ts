import { describe, expect, test } from "vitest";
import type { Emotion } from "../../../db/types";
import { createPresetListModel } from "../../../src/features/settings/utils/defaultPresetSelection";

describe("defaultPresetSelection", () => {
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
