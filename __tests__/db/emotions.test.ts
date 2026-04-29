import { vi } from "vitest";

/**
 * Tests for emotion management functions.
 */

import { createMockDb } from "./mockClient";

// Mock the database client module
const mockDb = createMockDb();

vi.mock("../../db/client", () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb)),
}));

// Import after mocking
import {
  getAllEmotions,
  addEmotion,
  updateEmotion,
  deleteEmotion,
  upsertEmotionCategory,
  linkEmotionsToMood,
} from "../../db/moods/emotions";
import type { Emotion } from "../../db/types";

describe("Emotions", () => {
  beforeEach(() => {
    mockDb.__reset();
    vi.clearAllMocks();
  });

  describe("getAllEmotions", () => {
    it("returns empty array when no emotions", async () => {
      const result = await getAllEmotions();
      expect(result).toEqual([]);
    });

    it("returns all emotions sorted by name", async () => {
      mockDb.__addEmotion({ name: "Calm", category: "positive" });
      mockDb.__addEmotion({ name: "Anxious", category: "negative" });
      mockDb.__addEmotion({ name: "Bored", category: "neutral" });

      const result = await getAllEmotions();

      expect(result).toHaveLength(3);
      // Sorted alphabetically by name
      expect(result[0].name).toBe("Anxious");
      expect(result[1].name).toBe("Bored");
      expect(result[2].name).toBe("Calm");
    });

    it("returns emotions with correct categories", async () => {
      mockDb.__addEmotion({ name: "Happy", category: "positive" });

      const result = await getAllEmotions();

      expect(result[0]).toEqual({ name: "Happy", category: "positive" });
    });
  });

  describe("addEmotion", () => {
    it("adds new emotion", async () => {
      const emotion: Emotion = { name: "Excited", category: "positive" };

      await addEmotion(emotion);

      const emotions = mockDb.__getEmotions();
      expect(emotions).toHaveLength(1);
      expect(emotions[0].name).toBe("Excited");
      expect(emotions[0].category).toBe("positive");
    });

    it("throws error for duplicate emotion name", async () => {
      mockDb.__addEmotion({ name: "Happy", category: "positive" });

      await expect(
        addEmotion({ name: "Happy", category: "neutral" })
      ).rejects.toThrow("An emotion with this name already exists");
    });
  });

  describe("updateEmotion", () => {
    it("updates emotion category", async () => {
      mockDb.__addEmotion({ name: "Neutral", category: "neutral" });

      await updateEmotion("Neutral", { name: "Neutral", category: "positive" });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE emotions"),
        "Neutral",
        "positive",
        "Neutral"
      );
    });

    it("renames emotion", async () => {
      mockDb.__addEmotion({ name: "Happy", category: "positive" });

      await updateEmotion("Happy", { name: "Joyful", category: "positive" });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE emotions"),
        "Joyful",
        "positive",
        "Happy"
      );
    });

    it("throws error when renaming to existing name", async () => {
      mockDb.__addEmotion({ name: "Happy", category: "positive" });
      mockDb.__addEmotion({ name: "Joyful", category: "positive" });

      await expect(
        updateEmotion("Happy", { name: "Joyful", category: "positive" })
      ).rejects.toThrow("An emotion with this name already exists");
    });
  });

  describe("deleteEmotion", () => {
    it("deletes emotion by name", async () => {
      mockDb.__addEmotion({ name: "Sad", category: "negative" });

      await deleteEmotion("Sad");

      const emotions = mockDb.__getEmotions();
      expect(emotions).toHaveLength(0);
    });

    it("is case-insensitive", async () => {
      mockDb.__addEmotion({ name: "Happy", category: "positive" });

      await deleteEmotion("happy");

      const emotions = mockDb.__getEmotions();
      expect(emotions).toHaveLength(0);
    });
  });

  describe("upsertEmotionCategory", () => {
    it("inserts new emotion if not exists", async () => {
      await upsertEmotionCategory("NewEmotion", "positive");

      const emotions = mockDb.__getEmotions();
      expect(emotions).toHaveLength(1);
      expect(emotions[0].name).toBe("NewEmotion");
      expect(emotions[0].category).toBe("positive");
    });

    it("updates category for existing emotion", async () => {
      mockDb.__addEmotion({ name: "Calm", category: "neutral" });

      await upsertEmotionCategory("Calm", "positive");

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE emotions SET category"),
        "positive",
        "Calm"
      );
    });
  });
});

describe("linkEmotionsToMood", () => {
  beforeEach(() => {
    mockDb.__reset();
    vi.clearAllMocks();
  });

  it("clears existing links before adding new ones", async () => {
    await linkEmotionsToMood(mockDb as any, 1, [
      { name: "Happy", category: "positive" },
    ]);

    // Should delete existing links first
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      "DELETE FROM mood_emotions WHERE mood_id = ?;",
      1
    );
  });

  it("creates emotion entries and links them", async () => {
    await linkEmotionsToMood(mockDb as any, 1, [
      { name: "Happy", category: "positive" },
      { name: "Excited", category: "positive" },
    ]);

    // Should have created/updated emotions and linked them
    const moodEmotions = mockDb.__getMoodEmotions();
    expect(moodEmotions).toHaveLength(2);
    expect(moodEmotions[0].mood_id).toBe(1);
    expect(moodEmotions[1].mood_id).toBe(1);
  });

  it("handles empty emotions array", async () => {
    await linkEmotionsToMood(mockDb as any, 1, []);

    // Should still clear existing links
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      "DELETE FROM mood_emotions WHERE mood_id = ?;",
      1
    );
    // But no new links should be created
    const moodEmotions = mockDb.__getMoodEmotions();
    expect(moodEmotions).toHaveLength(0);
  });
});
