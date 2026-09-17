import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_EMOTIONS } from "../../domain/entrySettings";
import { addEmotion, deleteEmotion, ensureDefaultEmotions, migrateEmotionsToTable, updateEmotion, upsertEmotionCategory } from "../../db/moods/emotions";
import { importMoods } from "../../db/moods/importExport";
import { insertMoodEntry } from "../../db/moods/repository";
import { createMockDb } from "./mockClient";

const mockDb = createMockDb();

vi.mock("../../db/client", () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb)),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
};

function createDeferred<T = void>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function isEmotionWrite(sql: string): boolean {
  return /^(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:main\.)?emotions\b/i.test(sql.trim());
}

/**
 * Holds a real production mood/import transaction after its first mood row is
 * inserted. The gate is released explicitly, so the assertions do not depend
 * on timing or sleeps.
 */
function holdFirstMoodInsert(rollback: boolean) {
  const started = createDeferred();
  const release = createDeferred();
  const original = mockDb.runAsync.getMockImplementation();
  if (!original) {
    throw new Error("mock database runAsync implementation is missing");
  }

  let moodInsertHeld = false;
  let emotionWriteAttempted = false;
  mockDb.runAsync.mockImplementation(async (sql, ...params) => {
    if (isEmotionWrite(sql)) {
      emotionWriteAttempted = true;
    }

    const result = await original(sql, ...params);
    if (!moodInsertHeld && /^INSERT INTO moods\b/i.test(sql.trim())) {
      moodInsertHeld = true;
      started.resolve();
      await release.promise;
      if (rollback) {
        throw new Error("held predecessor rolled back");
      }
    }
    return result;
  });

  return {
    started: started.promise,
    release: () => release.resolve(),
    emotionWriteWasAttempted: () => emotionWriteAttempted,
    restore: () => mockDb.runAsync.mockImplementation(original),
  };
}

const rollbackMutations = [
  {
    name: "addEmotion",
    prepare: () => undefined,
    run: () => addEmotion({ name: "Queued add", category: "positive" }),
    verify: () => {
      expect(mockDb.__getEmotions()).toEqual([
        { id: 1, name: "Queued add", category: "positive" },
      ]);
    },
  },
  {
    name: "updateEmotion",
    prepare: () => {
      mockDb.__addEmotion({ name: "Queued update", category: "neutral" });
    },
    run: () =>
      updateEmotion("Queued update", {
        name: "Queued renamed",
        category: "positive",
      }),
    verify: () => {
      expect(mockDb.__getEmotions()).toEqual([
        { id: 1, name: "Queued renamed", category: "positive" },
      ]);
    },
  },
  {
    name: "deleteEmotion",
    prepare: () => {
      mockDb.__addEmotion({ name: "Queued delete", category: "negative" });
    },
    run: () => deleteEmotion("Queued delete"),
    verify: () => expect(mockDb.__getEmotions()).toEqual([]),
  },
  {
    name: "upsertEmotionCategory",
    prepare: () => {
      mockDb.__addEmotion({ name: "Queued category", category: "neutral" });
    },
    run: () => upsertEmotionCategory("Queued category", "negative"),
    verify: () => {
      expect(mockDb.__getEmotions()).toEqual([
        { id: 1, name: "Queued category", category: "negative" },
      ]);
    },
  },
  {
    name: "ensureDefaultEmotions",
    prepare: () => undefined,
    run: () => ensureDefaultEmotions(),
    verify: () => {
      const rows = mockDb.__getEmotions();
      expect(rows).toHaveLength(DEFAULT_EMOTIONS.length);
      expect(rows.map(({ name }) => name)).toEqual(
        DEFAULT_EMOTIONS.map(({ name }) => name)
      );
    },
  },
] as const;

const defaultRunAsyncImplementation = mockDb.runAsync.getMockImplementation();
if (!defaultRunAsyncImplementation) {
  throw new Error("mock database runAsync implementation is missing");
}

describe("emotion write transaction isolation", () => {
  beforeEach(() => {
    mockDb.__reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockDb.runAsync.mockImplementation(defaultRunAsyncImplementation);
  });

  it.each(rollbackMutations)(
    "$name waits for a preceding queued mood transaction to roll back",
    async ({ prepare, run, verify }) => {
      prepare();
      const gate = holdFirstMoodInsert(true);
      const predecessor = insertMoodEntry({
        mood: 4,
        note: "rolled back predecessor",
        timestamp: 1705320000000,
      });
      await gate.started;

      let operationSettled = false;
      const operation = run().then(
        (value) => {
          operationSettled = true;
          return value;
        },
        (error: unknown) => {
          operationSettled = true;
          throw error;
        }
      );

      try {
        // The predecessor is still inside its real BEGIN. A queued emotion
        // mutation must not issue a write or settle its own promise yet.
        await Promise.resolve();
        expect(gate.emotionWriteWasAttempted()).toBe(false);
        expect(operationSettled).toBe(false);

        gate.release();
        const [predecessorResult, operationResult] = await Promise.allSettled([
          predecessor,
          operation,
        ]);

        expect(predecessorResult.status).toBe("rejected");
        expect(operationResult.status).toBe("fulfilled");
        expect(mockDb.__getMoods()).toEqual([]);
        verify();
      } finally {
        gate.release();
        await Promise.allSettled([predecessor, operation]);
        gate.restore();
      }
    }
  );

  it("runs an emotion mutation after a successful queued import transaction", async () => {
    const gate = holdFirstMoodInsert(false);
    const predecessor = importMoods(
      JSON.stringify([{ mood: 2, note: "successful import" }])
    );
    await gate.started;

    let operationSettled = false;
    const operation = addEmotion({ name: "After import", category: "positive" }).then(
      (value) => {
        operationSettled = true;
        return value;
      }
    );

    try {
      await Promise.resolve();
      expect(gate.emotionWriteWasAttempted()).toBe(false);
      expect(operationSettled).toBe(false);

      gate.release();
      const [predecessorResult, operationResult] = await Promise.allSettled([
        predecessor,
        operation,
      ]);

      expect(predecessorResult.status).toBe("fulfilled");
      expect(operationResult.status).toBe("fulfilled");
      expect(mockDb.__getMoods().map(({ note }) => note)).toEqual([
        "successful import",
      ]);
      expect(mockDb.__getEmotions()).toEqual([
        { id: 1, name: "After import", category: "positive" },
      ]);
    } finally {
      gate.release();
      await Promise.allSettled([predecessor, operation]);
      gate.restore();
    }
  });

  it("rolls back a failed emotion mutation and recovers the queue", async () => {
    mockDb.__addEmotion({ name: "Protected", category: "neutral" });
    await mockDb.execAsync(`
      CREATE TEMP TRIGGER reject_emotion_update
      BEFORE UPDATE ON emotions
      BEGIN
        SELECT RAISE(ABORT, 'injected emotion failure');
      END;
    `);

    await expect(
      upsertEmotionCategory("Protected", "positive")
    ).rejects.toThrow("injected emotion failure");
    expect(mockDb.__getEmotions()).toEqual([
      { id: 1, name: "Protected", category: "neutral" },
    ]);

    await mockDb.execAsync("DROP TRIGGER reject_emotion_update;");
    await upsertEmotionCategory("Protected", "positive");
    expect(mockDb.__getEmotions()).toEqual([
      { id: 1, name: "Protected", category: "positive" },
    ]);
  });

  it("makes concurrent default seeding and category upserts idempotent", async () => {
    await Promise.all([ensureDefaultEmotions(), ensureDefaultEmotions()]);
    const seeded = mockDb.__getEmotions();
    expect(seeded).toHaveLength(DEFAULT_EMOTIONS.length);
    expect(new Set(seeded.map(({ name }) => name)).size).toBe(
      DEFAULT_EMOTIONS.length
    );

    await Promise.all([
      upsertEmotionCategory("Concurrent category", "positive"),
      upsertEmotionCategory("Concurrent category", "negative"),
    ]);
    const matching = mockDb
      .__getEmotions()
      .filter(({ name }) => name === "Concurrent category");
    expect(matching).toHaveLength(1);
    expect(["positive", "negative"]).toContain(matching[0].category);
  });

  it("uses the passed handle for initialization migration without nested queue transactions", async () => {
    mockDb.__addMood({
      emotions: JSON.stringify([
        { name: "Migrated", category: "positive" },
      ]),
    });

    await expect(migrateEmotionsToTable(mockDb.database)).resolves.toEqual({
      migrated: 1,
    });
    expect(mockDb.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockDb.__getEmotions()).toEqual([
      { id: 1, name: "Migrated", category: "positive" },
    ]);
    expect(mockDb.__getMoodEmotions()).toEqual([
      { mood_id: 1, emotion_id: 1 },
    ]);

    // The queue remains usable after the initialization-only direct-handle
    // path completes.
    await addEmotion({ name: "After migration", category: "neutral" });
    expect(mockDb.withTransactionAsync).toHaveBeenCalledTimes(2);
  });
});
