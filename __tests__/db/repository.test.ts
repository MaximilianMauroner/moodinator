/**
 * Tests for database repository functions.
 * These tests use a mock SQLite client to verify CRUD operations.
 */

import { createMockDb } from "./mockClient";

// Mock the database client module
const mockDb = createMockDb();

jest.mock("../../db/client", () => ({
  getDb: jest.fn(() => Promise.resolve(mockDb)),
}));

// Mock emotions functions to avoid circular dependencies
jest.mock("../../db/moods/emotions", () => ({
  linkEmotionsToMood: jest.fn(),
  deleteEmotion: jest.fn(),
  upsertEmotionCategory: jest.fn(),
}));

// Import after mocking
import {
  insertMood,
  insertMoodEntry,
  getAllMoods,
  deleteMood,
  updateMoodNote,
  updateMoodTimestamp,
  updateMoodEntry,
  getMoodCount,
  hasMoodBeenLoggedToday,
} from "../../db/moods/repository";
import { linkEmotionsToMood } from "../../db/moods/emotions";

describe("Repository", () => {
  beforeEach(() => {
    mockDb.__reset();
    jest.clearAllMocks();
  });

  describe("insertMood", () => {
    it("inserts a basic mood entry", async () => {
      const result = await insertMood(7);

      expect(result.mood).toBe(7);
      expect(result.id).toBe(1);
      expect(result.note).toBeNull();
      expect(mockDb.execAsync).toHaveBeenCalledWith("BEGIN TRANSACTION;");
      expect(mockDb.execAsync).toHaveBeenCalledWith("COMMIT;");
    });

    it("inserts mood with note", async () => {
      const result = await insertMood(7, "Feeling great today");

      expect(result.mood).toBe(7);
      expect(result.note).toBe("Feeling great today");
    });

    it("inserts mood with metadata", async () => {
      const result = await insertMood(8, "Test note", {
        emotions: [{ name: "Happy", category: "positive" }],
        contextTags: ["work"],
        energy: 7,
        timestamp: 1705320000000,
      });

      expect(result.mood).toBe(8);
      expect(result.note).toBe("Test note");
      expect(linkEmotionsToMood).toHaveBeenCalled();
    });

    it("links emotions when provided", async () => {
      const emotions = [{ name: "Happy", category: "positive" as const }];
      await insertMood(7, undefined, { emotions });

      expect(linkEmotionsToMood).toHaveBeenCalledWith(
        expect.anything(),
        1,
        emotions
      );
    });

    it("rolls back on error", async () => {
      mockDb.runAsync.mockRejectedValueOnce(new Error("DB Error"));

      await expect(insertMood(7)).rejects.toThrow("DB Error");
      expect(mockDb.execAsync).toHaveBeenCalledWith("ROLLBACK;");
    });
  });

  describe("insertMoodEntry", () => {
    it("inserts complete mood entry", async () => {
      const entry = {
        mood: 6,
        note: "Test",
        emotions: [{ name: "Calm", category: "positive" as const }],
        contextTags: ["home"],
        energy: 5,
      };

      const result = await insertMoodEntry(entry);

      expect(result.mood).toBe(6);
      expect(result.id).toBe(1);
    });

    it("links emotions when provided", async () => {
      const emotions = [{ name: "Calm", category: "positive" as const }];
      await insertMoodEntry({ mood: 5, emotions });

      expect(linkEmotionsToMood).toHaveBeenCalled();
    });
  });

  describe("getAllMoods", () => {
    it("returns empty array when no moods", async () => {
      const result = await getAllMoods();
      expect(result).toEqual([]);
    });

    it("returns all moods sorted by timestamp DESC", async () => {
      mockDb.__addMood({ mood: 5, timestamp: 1000 });
      mockDb.__addMood({ mood: 7, timestamp: 3000 });
      mockDb.__addMood({ mood: 3, timestamp: 2000 });

      const result = await getAllMoods();

      expect(result).toHaveLength(3);
      expect(result[0].timestamp).toBe(3000);
      expect(result[1].timestamp).toBe(2000);
      expect(result[2].timestamp).toBe(1000);
    });

    it("deserializes emotions correctly", async () => {
      mockDb.__addMood({
        mood: 5,
        emotions: '[{"name":"Happy","category":"positive"}]',
      });

      const result = await getAllMoods();

      expect(result[0].emotions).toEqual([{ name: "Happy", category: "positive" }]);
    });
  });

  describe("deleteMood", () => {
    it("deletes mood by id", async () => {
      mockDb.__addMood({ mood: 5 });

      await deleteMood(1);

      const moods = mockDb.__getMoods();
      expect(moods).toHaveLength(0);
    });

    it("returns changes count", async () => {
      mockDb.__addMood({ mood: 5 });

      const result = await deleteMood(1);

      expect(result.changes).toBe(1);
    });
  });

  describe("updateMoodNote", () => {
    it("updates note for existing mood", async () => {
      mockDb.__addMood({ mood: 5, note: "Original" });

      const result = await updateMoodNote(1, "Updated note");

      expect(result).toBeDefined();
      expect(result?.note).toBe("Updated note");
    });

    it("returns undefined for non-existent mood", async () => {
      const result = await updateMoodNote(999, "Note");
      expect(result).toBeUndefined();
    });
  });

  describe("updateMoodTimestamp", () => {
    it("updates timestamp for existing mood", async () => {
      mockDb.__addMood({ mood: 5, timestamp: 1000 });

      const result = await updateMoodTimestamp(1, 2000);

      expect(result).toBeDefined();
      expect(result?.timestamp).toBe(2000);
    });
  });

  describe("updateMoodEntry", () => {
    it("returns current entry when no updates provided", async () => {
      mockDb.__addMood({ mood: 5 });

      const result = await updateMoodEntry(1, {});

      expect(result).toBeDefined();
      expect(result?.mood).toBe(5);
    });

    it("updates mood value", async () => {
      mockDb.__addMood({ mood: 5 });

      const result = await updateMoodEntry(1, { mood: 8 });

      expect(result?.mood).toBe(8);
    });

    it("updates multiple fields", async () => {
      mockDb.__addMood({ mood: 5, note: "Original" });

      const result = await updateMoodEntry(1, {
        mood: 7,
        note: "Updated",
        energy: 8,
      });

      expect(result).toBeDefined();
    });

    it("links emotions when emotions are updated", async () => {
      mockDb.__addMood({ mood: 5 });

      await updateMoodEntry(1, {
        emotions: [{ name: "Happy", category: "positive" }],
      });

      expect(linkEmotionsToMood).toHaveBeenCalled();
    });

    it("uses transaction for updates", async () => {
      mockDb.__addMood({ mood: 5 });

      await updateMoodEntry(1, { mood: 7 });

      expect(mockDb.execAsync).toHaveBeenCalledWith("BEGIN TRANSACTION;");
      expect(mockDb.execAsync).toHaveBeenCalledWith("COMMIT;");
    });

    it("rolls back on error", async () => {
      mockDb.__addMood({ mood: 5 });
      mockDb.runAsync.mockRejectedValueOnce(new Error("Update failed"));

      await expect(updateMoodEntry(1, { mood: 7 })).rejects.toThrow(
        "Update failed"
      );
      expect(mockDb.execAsync).toHaveBeenCalledWith("ROLLBACK;");
    });
  });

  describe("getMoodCount", () => {
    it("returns 0 when no moods", async () => {
      const result = await getMoodCount();
      expect(result).toBe(0);
    });

    it("returns correct count", async () => {
      mockDb.__addMood({ mood: 5 });
      mockDb.__addMood({ mood: 7 });
      mockDb.__addMood({ mood: 3 });

      const result = await getMoodCount();
      expect(result).toBe(3);
    });
  });

  describe("hasMoodBeenLoggedToday", () => {
    it("returns false when no moods today", async () => {
      // Add a mood from yesterday
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      mockDb.__addMood({ mood: 5, timestamp: yesterday });

      const result = await hasMoodBeenLoggedToday();
      expect(result).toBe(false);
    });

    it("returns true when mood logged today", async () => {
      mockDb.__addMood({ mood: 5, timestamp: Date.now() });

      const result = await hasMoodBeenLoggedToday();
      expect(result).toBe(true);
    });
  });
});
