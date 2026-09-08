import { vi } from "vitest";
import { createMockDb } from "./mockClient";

import { createMoodTable } from "../../db/moods/schema";
import { backfillMoodScaleJson } from "../../db/moods/migrations";
import { CURRENT_MOOD_SCALE_SNAPSHOT, serializeMoodScale } from "../../db/moods/serialization";

const fixture = createMockDb();
vi.mock("../../db/client", () => ({ getDb: vi.fn(() => Promise.resolve(fixture)) }));

describe("backfillMoodScaleJson with SQLite", () => {
  beforeEach(() => fixture.__reset());

  it("backfills NULL and empty scales, preserves saved scales, and is idempotent", async () => {
    const preset = JSON.stringify({ version: 1, min: 0, max: 5, lowerIsBetter: false });
    fixture.__addMood({ mood_scale_json: null });
    fixture.__addMood({ mood_scale_json: "" });
    fixture.__addMood({ mood_scale_json: preset });

    expect(await backfillMoodScaleJson(fixture.database)).toEqual({ backfilled: 2 });
    const expected = serializeMoodScale(CURRENT_MOOD_SCALE_SNAPSHOT);
    expect(fixture.__getMoods().map((row) => row.mood_scale_json)).toEqual([expected, expected, preset]);
    expect(await backfillMoodScaleJson(fixture.database)).toEqual({ backfilled: 0 });
  });
});

describe("schema upgrade with SQLite", () => {
  it("upgrades an old mood table without losing entries and can run twice", async () => {
    await fixture.execAsync(`
      DROP TABLE mood_emotions;
      DROP TABLE emotions;
      DROP TABLE moods;
      CREATE TABLE moods (id INTEGER PRIMARY KEY AUTOINCREMENT, mood INTEGER NOT NULL, note TEXT, timestamp DATETIME);
      INSERT INTO moods (mood, note, timestamp) VALUES (3, 'legacy entry', 1000);
    `);
    await createMoodTable(fixture.database);
    await createMoodTable(fixture.database);
    await backfillMoodScaleJson(fixture.database);
    expect(fixture.__getMoods()).toEqual([expect.objectContaining({
      id: 1, mood: 3, note: "legacy entry", timestamp: 1000,
      emotions: "[]", context_tags: "[]", energy: null,
      mood_scale_json: serializeMoodScale(CURRENT_MOOD_SCALE_SNAPSHOT),
    })]);
    const indexes = await fixture.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'index';");
    expect(indexes.map((index) => index.name)).toEqual(expect.arrayContaining([
      "idx_moods_timestamp", "idx_mood_emotions_mood_id", "idx_emotions_name", "idx_mood_emotions_emotion_id",
    ]));
    expect(await fixture.getAllAsync("PRAGMA foreign_key_check;")).toEqual([]);
  });
});

describe("pre-removal attachment schema", () => {
  it("retains old columns and data while current writes and export/import work", async () => {
    const { insertMoodEntry, getAllMoods } = await import("../../db/moods/repository");
    const { exportMoods, importMoods } = await import("../../db/moods/importExport");
    await fixture.execAsync(`
      DROP TABLE mood_emotions; DROP TABLE emotions; DROP TABLE moods;
      CREATE TABLE moods (
        id INTEGER PRIMARY KEY AUTOINCREMENT, mood INTEGER NOT NULL, note TEXT,
        timestamp DATETIME, emotions TEXT DEFAULT '[]', context_tags TEXT DEFAULT '[]',
        energy INTEGER, mood_scale_json TEXT, photos_json TEXT DEFAULT '[]',
        location_json TEXT, voice_memos_json TEXT DEFAULT '[]', based_on_entry_id INTEGER
      );
      INSERT INTO moods (mood, note, timestamp, photos_json) VALUES (3, 'legacy', 1705320000000, '["retained"]');
    `);
    await createMoodTable(fixture.database);
    await createMoodTable(fixture.database);
    expect((await getAllMoods())[0].note).toBe("legacy");
    await insertMoodEntry({ mood: 4, timestamp: 1705320001000 });
    const rows = await fixture.getAllAsync("SELECT photos_json, utc_offset_minutes FROM moods ORDER BY id;");
    expect(rows[0]).toMatchObject({ photos_json: '["retained"]', utc_offset_minutes: null });
    expect(rows[1].photos_json).toBe("[]");
    const exported = await exportMoods();
    await importMoods(exported);
    expect(await exportMoods()).toBe(exported);
  });
});
