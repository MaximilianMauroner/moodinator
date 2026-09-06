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
      photos_json: "[]", location_json: null, voice_memos_json: "[]", based_on_entry_id: null,
    })]);
    const indexes = await fixture.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'index';");
    expect(indexes.map((index) => index.name)).toEqual(expect.arrayContaining([
      "idx_moods_timestamp", "idx_mood_emotions_mood_id", "idx_emotions_name", "idx_mood_emotions_emotion_id",
    ]));
    expect(await fixture.getAllAsync("PRAGMA foreign_key_check;")).toEqual([]);
  });
});
