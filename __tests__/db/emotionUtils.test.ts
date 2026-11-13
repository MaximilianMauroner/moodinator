import { describe, expect, it } from "vitest";

import { parseEmotionItem } from "../../db/moods/emotionUtils";

describe("parseEmotionItem", () => {
  it("drops values that are not an emotion name", () => {
    expect(parseEmotionItem(null)).toBeNull();
    expect(parseEmotionItem(undefined)).toBeNull();
    expect(parseEmotionItem(0)).toBeNull();
    expect(parseEmotionItem("")).toBeNull();
    expect(parseEmotionItem("   ")).toBeNull();
    expect(parseEmotionItem({})).toBeNull();
    expect(parseEmotionItem([])).toBeNull();
    expect(parseEmotionItem({ category: "positive" })).toBeNull();
  });

  it("resolves a legacy string to its built-in category without inventing energy", () => {
    expect(parseEmotionItem("  Happy  ")).toEqual({
      name: "Happy",
      category: "positive",
    });
    expect(parseEmotionItem("happy")).toEqual({
      name: "happy",
      category: "neutral",
    });
    expect(parseEmotionItem("On the train")).toEqual({
      name: "On the train",
      category: "neutral",
    });
    expect(parseEmotionItem("Happy")).not.toHaveProperty("energy");
  });

  it("keeps a stored category and only a real energy band", () => {
    expect(
      parseEmotionItem({
        name: "  Happy  ",
        category: "negative",
        energy: "low",
      }),
    ).toEqual({ name: "Happy", category: "negative", energy: "low" });
    expect(parseEmotionItem({ name: "Happy" })).toEqual({
      name: "Happy",
      category: "neutral",
    });
    expect(
      parseEmotionItem({ name: "Happy", category: "positive", energy: "medium" }),
    ).toEqual({ name: "Happy", category: "positive" });
  });
});
