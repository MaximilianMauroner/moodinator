/**
 * Tests for import/export functionality.
 */

import { createMockDb } from "./mockClient";

// Mock the database client module
const mockDb = createMockDb();

jest.mock("../../db/client", () => ({
  getDb: jest.fn(() => Promise.resolve(mockDb)),
}));

// Mock emotions functions
jest.mock("../../db/moods/emotions", () => ({
  linkEmotionsToMood: jest.fn(),
}));

// Import after mocking
import { exportMoods, importMoods, importOldBackup } from "../../db/moods/importExport";
import { linkEmotionsToMood } from "../../db/moods/emotions";

describe("Import/Export", () => {
  beforeEach(() => {
    mockDb.__reset();
    jest.clearAllMocks();
  });

  describe("exportMoods", () => {
    it("exports empty array when no moods", async () => {
      const result = await exportMoods();
      expect(JSON.parse(result)).toEqual([]);
    });

    it("exports moods with correct format", async () => {
      mockDb.__addMood({
        mood: 7,
        note: "Great day",
        timestamp: 1705320000000,
        emotions: '[{"name":"Happy","category":"positive"}]',
        context_tags: '["work"]',
        energy: 8,
      });

      const result = await exportMoods();
      const parsed = JSON.parse(result);

      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toEqual({
        timestamp: 1705320000000,
        mood: 7,
        emotions: [{ name: "Happy", category: "positive" }],
        context: ["work"],
        energy: 8,
        notes: "Great day",
      });
    });

    it("exports multiple moods", async () => {
      mockDb.__addMood({ mood: 5, timestamp: 1000 });
      mockDb.__addMood({ mood: 7, timestamp: 2000 });

      const result = await exportMoods();
      const parsed = JSON.parse(result);

      expect(parsed).toHaveLength(2);
    });

    it("exports moods within date range", async () => {
      mockDb.__addMood({ mood: 5, timestamp: 1000 });
      mockDb.__addMood({ mood: 7, timestamp: 2000 });
      mockDb.__addMood({ mood: 3, timestamp: 3000 });

      const result = await exportMoods({ startDate: 1500, endDate: 2500 });
      const parsed = JSON.parse(result);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].mood).toBe(7);
    });
  });

  describe("importMoods", () => {
    it("imports moods from JSON", async () => {
      const data = JSON.stringify([
        {
          mood: 7,
          notes: "Test note",
          timestamp: 1705320000000,
          emotions: [{ name: "Happy", category: "positive" }],
          context: ["work"],
          energy: 8,
        },
      ]);

      const count = await importMoods(data);

      expect(count).toBe(1);
      const moods = mockDb.__getMoods();
      expect(moods).toHaveLength(1);
      expect(moods[0].mood).toBe(7);
    });

    it("links emotions during import", async () => {
      const data = JSON.stringify([
        {
          mood: 5,
          emotions: [{ name: "Calm", category: "positive" }],
        },
      ]);

      await importMoods(data);

      expect(linkEmotionsToMood).toHaveBeenCalled();
    });

    it("handles note vs notes field", async () => {
      const dataWithNotes = JSON.stringify([{ mood: 5, notes: "Using notes" }]);
      const dataWithNote = JSON.stringify([{ mood: 6, note: "Using note" }]);

      await importMoods(dataWithNotes);
      await importMoods(dataWithNote);

      const moods = mockDb.__getMoods();
      expect(moods[0].note).toBe("Using notes");
      expect(moods[1].note).toBe("Using note");
    });

    it("handles contextTags vs context field", async () => {
      const dataWithContext = JSON.stringify([
        { mood: 5, context: ["work"] },
      ]);
      const dataWithContextTags = JSON.stringify([
        { mood: 6, contextTags: ["home"] },
      ]);

      await importMoods(dataWithContext);
      await importMoods(dataWithContextTags);

      const moods = mockDb.__getMoods();
      expect(JSON.parse(moods[0].context_tags)).toEqual(["work"]);
      expect(JSON.parse(moods[1].context_tags)).toEqual(["home"]);
    });

    it("sanitizes imported emotions", async () => {
      const data = JSON.stringify([
        {
          mood: 5,
          emotions: ["Happy", { name: "Sad", category: "negative" }],
        },
      ]);

      await importMoods(data);

      // String emotions should be converted to objects with neutral category
      expect(linkEmotionsToMood).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number),
        expect.arrayContaining([
          { name: "Happy", category: "neutral" },
          { name: "Sad", category: "negative" },
        ])
      );
    });

    it("throws error for invalid JSON", async () => {
      await expect(importMoods("not valid json")).rejects.toThrow(
        "Invalid mood data format"
      );
    });

    it("returns count of imported moods", async () => {
      const data = JSON.stringify([
        { mood: 5 },
        { mood: 6 },
        { mood: 7 },
      ]);

      const count = await importMoods(data);

      expect(count).toBe(3);
    });
  });

  describe("importOldBackup", () => {
    it("imports legacy backup format", async () => {
      const data = JSON.stringify([
        {
          mood: 7,
          notes: "Old backup",
          timestamp: "2024-01-15T12:00:00Z",
          emotions: ["Happy", "Excited"],
        },
      ]);

      const count = await importOldBackup(data);

      expect(count).toBe(1);
      const moods = mockDb.__getMoods();
      expect(moods[0].mood).toBe(7);
    });

    it("uses transactions", async () => {
      const data = JSON.stringify([{ mood: 5 }]);

      await importOldBackup(data);

      expect(mockDb.execAsync).toHaveBeenCalledWith("BEGIN TRANSACTION;");
      expect(mockDb.execAsync).toHaveBeenCalledWith("COMMIT;");
    });

    it("rolls back on error", async () => {
      mockDb.runAsync.mockRejectedValueOnce(new Error("Import failed"));

      await expect(importOldBackup(JSON.stringify([{ mood: 5 }]))).rejects.toThrow(
        "Invalid backup data format"
      );
      expect(mockDb.execAsync).toHaveBeenCalledWith("ROLLBACK;");
    });

    it("handles string emotions by converting to objects", async () => {
      const data = JSON.stringify([
        {
          mood: 5,
          emotions: ["Happy", "Sad"],
        },
      ]);

      await importOldBackup(data);

      expect(linkEmotionsToMood).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number),
        expect.arrayContaining([
          expect.objectContaining({ name: "Happy" }),
          expect.objectContaining({ name: "Sad" }),
        ])
      );
    });
  });

  describe("Round-trip import/export", () => {
    it("preserves data through export and import cycle", async () => {
      // Add some moods
      mockDb.__addMood({
        mood: 7,
        note: "Great day",
        timestamp: 1705320000000,
        emotions: '[{"name":"Happy","category":"positive"}]',
        context_tags: '["work","meeting"]',
        energy: 8,
      });

      // Export
      const exported = await exportMoods();
      const parsedExport = JSON.parse(exported);

      // Clear and reimport
      mockDb.__reset();
      await importMoods(exported);

      // Verify
      const moods = mockDb.__getMoods();
      expect(moods).toHaveLength(1);
      expect(moods[0].mood).toBe(7);
      expect(moods[0].note).toBe("Great day");
      expect(moods[0].timestamp).toBe(1705320000000);
      expect(moods[0].energy).toBe(8);
    });

    it("handles empty data gracefully", async () => {
      const exported = await exportMoods();
      expect(JSON.parse(exported)).toEqual([]);

      const count = await importMoods(exported);
      expect(count).toBe(0);
    });
  });
});
