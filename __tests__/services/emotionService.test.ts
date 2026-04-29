import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockDb } from "../db/mockClient";

const mockDb = createMockDb();

vi.mock("../../db/client", () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb)),
}));

import { emotionService } from "../../src/services/emotionService";

describe("emotionService", () => {
  beforeEach(() => {
    mockDb.__reset();
    vi.clearAllMocks();
  });

  it("deletes an emotion from future selection without rewriting past mood entries", async () => {
    mockDb.__addEmotion({ name: "Happy", category: "positive" });
    mockDb.__addMood({
      emotions: JSON.stringify([{ name: "Happy", category: "positive" }]),
    });

    await emotionService.delete("Happy");

    expect(mockDb.__getEmotions()).toEqual([]);
    expect(mockDb.__getMoods()[0]?.emotions).toBe(
      JSON.stringify([{ name: "Happy", category: "positive" }])
    );
  });

  it("previews a rename historical update with an exact count across all matching snapshots", async () => {
    mockDb.__addEmotion({ name: "Happy", category: "positive" });
    mockDb.__addMood({
      emotions: JSON.stringify([{ name: "Happy", category: "positive" }]),
    });
    mockDb.__addMood({
      emotions: JSON.stringify([
        { name: "happy", category: "positive" },
        { name: "Calm", category: "neutral" },
      ]),
    });
    mockDb.__addMood({
      emotions: JSON.stringify([{ name: "Sad", category: "negative" }]),
    });

    const preview = await emotionService.previewRenameHistoricalUpdate("Happy", "Joyful");

    expect(preview).toEqual({ affectedMoodEntryCount: 2 });
  });

  it("rejects a rename historical update when the target name already exists", async () => {
    mockDb.__addEmotion({ name: "Happy", category: "positive" });
    mockDb.__addEmotion({ name: "Joyful", category: "positive" });

    await expect(
      emotionService.applyRenameHistoricalUpdate("Happy", "Joyful")
    ).rejects.toThrow("An emotion with this name already exists");
  });

  it("applies a rename historical update to all matching snapshots globally", async () => {
    mockDb.__addEmotion({ name: "Happy", category: "positive" });
    mockDb.__addMood({
      emotions: JSON.stringify([{ name: "Happy", category: "positive" }]),
    });
    mockDb.__addMood({
      emotions: JSON.stringify([
        { name: "happy", category: "positive" },
        { name: "Calm", category: "neutral" },
      ]),
    });

    await emotionService.applyRenameHistoricalUpdate("Happy", "Joyful");

    expect(mockDb.__getEmotions()).toEqual([
      { id: 1, name: "Joyful", category: "positive" },
    ]);
    expect(mockDb.__getMoods().map((mood) => mood.emotions)).toEqual([
      JSON.stringify([{ name: "Joyful", category: "positive" }]),
      JSON.stringify([
        { name: "Joyful", category: "positive" },
        { name: "Calm", category: "neutral" },
      ]),
    ]);
  });

  it("previews a category historical update with an exact count across all matching snapshots", async () => {
    mockDb.__addEmotion({ name: "Calm", category: "neutral" });
    mockDb.__addMood({
      emotions: JSON.stringify([{ name: "Calm", category: "neutral" }]),
    });
    mockDb.__addMood({
      emotions: JSON.stringify([
        { name: "calm", category: "neutral" },
        { name: "Happy", category: "positive" },
      ]),
    });

    const preview = await emotionService.previewCategoryHistoricalUpdate(
      "Calm",
      "positive"
    );

    expect(preview).toEqual({ affectedMoodEntryCount: 2 });
  });

  it("applies a category historical update to all matching snapshots globally", async () => {
    mockDb.__addEmotion({ name: "Calm", category: "positive" });
    mockDb.__addMood({
      emotions: JSON.stringify([{ name: "Calm", category: "neutral" }]),
    });
    mockDb.__addMood({
      emotions: JSON.stringify([
        { name: "calm", category: "neutral" },
        { name: "Happy", category: "positive" },
      ]),
    });

    await emotionService.applyCategoryHistoricalUpdate("Calm", "positive");

    expect(mockDb.__getMoods().map((mood) => mood.emotions)).toEqual([
      JSON.stringify([{ name: "Calm", category: "positive" }]),
      JSON.stringify([
        { name: "calm", category: "positive" },
        { name: "Happy", category: "positive" },
      ]),
    ]);
  });

  it("returns importable emotion names from past mood entries", async () => {
    mockDb.__addMood({
      emotions: JSON.stringify([
        { name: "Happy", category: "positive" },
        { name: "Calm", category: "neutral" },
      ]),
    });
    mockDb.__addMood({
      emotions: JSON.stringify([{ name: "happy", category: "positive" }]),
    });

    await expect(emotionService.getImportableEmotionNames()).resolves.toEqual([
      "Calm",
      "Happy",
    ]);
  });

  it("applies imported emotion additions without duplicating existing emotion names", async () => {
    mockDb.__addEmotion({ name: "Happy", category: "positive" });

    await emotionService.applyImportedEmotionAdditions(["Happy", "Calm", "calm"]);

    expect(mockDb.__getEmotions()).toEqual([
      { id: 1, name: "Happy", category: "positive" },
      { id: 2, name: "Calm", category: "neutral" },
    ]);
  });
});
