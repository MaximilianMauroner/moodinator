import { vi } from "vitest";
import { createMockDb } from "./mockClient";
import {
  getMoodHistorySummary,
  getMoodsInRange,
  getMoodsPaginated,
} from "../../db/moods/repository";
import { getEntryLocalDayKey } from "../../src/lib/entryTimezone";

const db = createMockDb();
vi.mock("../../db/client", () => ({ getDb: vi.fn(async () => db) }));

const HOUR = 60 * 60 * 1000;
const BASE = Date.UTC(2025, 0, 1);

beforeEach(() => db.__reset());

it.each([1_000, 10_000])(
  "preserves pagination, range, filter and summary correctness with %i entries",
  async (count) => {
    const fixture = Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      // Ties straddle page boundaries, so timestamp-only ordering is insufficient.
      timestamp: BASE + Math.floor(index / 3) * HOUR,
      mood: index % 11,
      utcOffsetMinutes: [-840, -120, 0, 330, 840, null][index % 6],
      note: index % 2 === 0 ? "WORK checkpoint" : "Quiet moment",
      work: index % 3 === 0,
      tired: index % 5 === 0,
      legacyScale: index % 7 === 0,
    }));

    // One bulk statement inside a transaction keeps fixture setup independent
    // of the query behavior being checked and avoids thousands of async writes.
    await db.execAsync("BEGIN TRANSACTION;");
    try {
      await db.runAsync(`
        INSERT INTO moods (
          id, timestamp, mood, utc_offset_minutes, note, context_tags,
          emotions, mood_scale_json
        )
        SELECT json_extract(value, '$.id'), json_extract(value, '$.timestamp'),
          json_extract(value, '$.mood'), json_extract(value, '$.utcOffsetMinutes'),
          json_extract(value, '$.note'),
          CASE WHEN json_extract(value, '$.work') THEN '["Work"]' ELSE '["Home"]' END,
          CASE WHEN json_extract(value, '$.tired') THEN '["Tired"]' ELSE '[]' END,
          CASE WHEN json_extract(value, '$.legacyScale')
            THEN '{"version":2,"min":0,"max":10,"lowerIsBetter":false}'
            ELSE NULL END
        FROM json_each(?);
      `, JSON.stringify(fixture));
      await db.execAsync("COMMIT;");
    } catch (error) {
      await db.execAsync("ROLLBACK;");
      throw error;
    }

    const newestFirst = [...fixture].sort(
      (a, b) => b.timestamp - a.timestamp || b.id - a.id
    );
    const ids: number[] = [];
    for (let offset = 0; offset < count; offset += 50) {
      const page = await getMoodsPaginated({ limit: 50, offset });
      expect(page.total).toBe(count);
      expect(page.data).toHaveLength(Math.min(50, count - offset));
      expect(page.hasMore).toBe(offset + page.data.length < count);
      expect(page.data.map((entry) => entry.id)).toEqual(
        newestFirst.slice(offset, offset + 50).map((entry) => entry.id)
      );
      ids.push(...page.data.map((entry) => entry.id));
    }
    expect(ids).toEqual(newestFirst.map((entry) => entry.id));
    expect(new Set(ids).size).toBe(count);
    expect(await getMoodsPaginated({ limit: 50, offset: count })).toEqual({
      data: [], total: count, hasMore: false,
    });

    const startDate = BASE + 24 * HOUR;
    const endDate = BASE + 120 * HOUR;
    const inRange = newestFirst.filter(
      (entry) => entry.timestamp >= startDate && entry.timestamp <= endDate
    );
    expect((await getMoodsInRange(startDate, endDate)).map((entry) => entry.id))
      .toEqual(inRange.map((entry) => entry.id));

    const expectedFiltered = inRange.filter((entry) => {
      const interpretedMood = entry.legacyScale ? 10 - entry.mood : entry.mood;
      return entry.note.toLowerCase().includes("work") && entry.work && entry.tired
        && interpretedMood >= 7;
    });
    expect(expectedFiltered.length).toBeGreaterThan(0);
    const filtered = await getMoodsPaginated({
      limit: 50,
      offset: 0,
      filters: {
        text: "work", contexts: ["Work"], emotions: ["Tired"], minMood: 7,
        startDate, endDate,
      },
    });
    expect(filtered.total).toBe(expectedFiltered.length);
    expect(filtered.data.map((entry) => entry.id))
      .toEqual(expectedFiltered.slice(0, 50).map((entry) => entry.id));

    const expectedDays = new Set(fixture.map(getEntryLocalDayKey));
    const summary = await getMoodHistorySummary();
    expect(summary.totalCount).toBe(count);
    expect(summary.oldestTimestamp).toBe(BASE);
    expect(summary.days).toHaveLength(expectedDays.size);
    expect(new Set(summary.days.map(getEntryLocalDayKey))).toEqual(expectedDays);
  }
);
