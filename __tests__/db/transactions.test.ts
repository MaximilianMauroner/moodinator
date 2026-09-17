import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Transaction safety across concurrent callers.
 *
 * The mock runs real SQLite, so a nested BEGIN fails here exactly as it does on
 * a device. These tests describe what callers may assume when two writes
 * overlap, which is the guarantee the hand-rolled BEGIN/COMMIT pairs did not
 * provide.
 */

import { createMockDb } from "./mockClient";

import { insertMoodEntry, updateMoodEntry, deleteMood } from "../../db/moods/repository";
import { importMoods } from "../../db/moods/importExport";

const mockDb = createMockDb();

vi.mock("../../db/client", () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb)),
}));

describe("concurrent writes", () => {
  beforeEach(() => {
    mockDb.__reset();
    vi.clearAllMocks();
  });

  it("commits both entries when two inserts overlap", async () => {
    const [first, second] = await Promise.all([
      insertMoodEntry({ mood: 2, note: "first", timestamp: 1705320000000 }),
      insertMoodEntry({ mood: 8, note: "second", timestamp: 1705320001000 }),
    ]);

    expect(first.id).not.toBe(second.id);
    const stored = mockDb.__getMoods();
    expect(stored).toHaveLength(2);
    expect(stored.map((row) => row.note).sort()).toEqual(["first", "second"]);
  });

  it("keeps every entry when many inserts are started at once", async () => {
    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        insertMoodEntry({ mood: index % 11, timestamp: 1705320000000 + index })
      )
    );

    expect(mockDb.__getMoods()).toHaveLength(12);
  });

  it("does not let a failing write roll back a concurrent one", async () => {
    const settled = await Promise.allSettled([
      insertMoodEntry({ mood: 4, note: "keeper", timestamp: 1705320000000 }),
      // A null mood violates NOT NULL, so this transaction must roll back.
      insertMoodEntry({
        mood: null as unknown as number,
        note: "doomed",
        timestamp: 1705320001000,
      }),
    ]);

    expect(settled.map((entry) => entry.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const stored = mockDb.__getMoods();
    expect(stored).toHaveLength(1);
    expect(stored[0].note).toBe("keeper");
  });

  it("serializes an insert against a concurrent replacement import", async () => {
    const [, imported] = await Promise.all([
      insertMoodEntry({ mood: 1, note: "racing", timestamp: 1705320000000 }),
      importMoods(JSON.stringify([{ mood: 6, note: "imported" }])),
    ]);

    expect(imported.imported).toBe(1);
    // The import replaces the history, so the outcome depends on ordering, but
    // it must be one of the two clean results rather than a torn mix.
    const notes = mockDb.__getMoods().map((row) => row.note);
    expect([["imported"], ["imported", "racing"]]).toContainEqual(notes);
  });

  it("serializes an update and a delete against each other", async () => {
    const entry = await insertMoodEntry({ mood: 3, timestamp: 1705320000000 });

    const settled = await Promise.allSettled([
      updateMoodEntry(entry.id, { note: "edited" }),
      deleteMood(entry.id),
    ]);

    expect(settled.every((result) => result.status === "fulfilled")).toBe(true);
    expect(mockDb.__getMoods()).toHaveLength(0);
  });
});
