import { vi } from "vitest";
import { createMockDb } from "./mockClient";
import { getMoodsPaginated, getMoodsInRange, getAllMoods } from "../../db/moods/repository";
import type { MoodHistoryFilters } from "../../db/moods/repository";
import { LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT } from "../../domain/moodScale";
const db = createMockDb();
vi.mock("../../db/client", () => ({ getDb: vi.fn(async () => db) }));
beforeEach(() => db.__reset());
const query = (filters: MoodHistoryFilters = {}) => getMoodsPaginated({ limit: 20, offset: 0, filters });

it("combines note, interpreted mood, emotion, context and inclusive dates", async () => {
  const matching = db.__addMood({ mood: 2, note: "WORK feels hard", timestamp: 2000,
    emotions: '[{"name":"Tired","category":"negative"}]', context_tags: '["Work","Home"]',
    mood_scale_json: JSON.stringify(LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT) });
  db.__addMood({ mood: 2, note: "work", timestamp: 2000, emotions: '["Tired"]', context_tags: '["Work"]' });
  db.__addMood({ mood: 8, note: "work", timestamp: 3000, emotions: '["Tired"]', context_tags: '["Work"]' });
  expect((await query({ text: "feels" })).total).toBe(1);
  expect((await query({ minMood: 7 })).total).toBe(2);
  expect((await query({ maxMood: 3 })).total).toBe(1);
  expect((await query({ emotions: ["tired"] })).total).toBe(3);
  expect((await query({ contexts: ["home"] })).total).toBe(1);
  expect((await query({ startDate: 2000, endDate: 2000 })).total).toBe(2);
  const result = await query({ text: "work", minMood: 7, maxMood: 9, emotions: ["tired"], contexts: ["Work", "Home"], startDate: 2000, endDate: 2000 });
  expect(result.data.map(entry => entry.id)).toEqual([matching.id]);
  expect(result.hasMore).toBe(false);
  expect((await query({ contexts: ["Missing"] })).data).toEqual([]);
});

it("escapes wildcard and escape characters as literal note substrings", async () => {
  db.__addMood({ note: "100%_\\ Complete" });
  db.__addMood({ note: "100something Complete" });
  expect((await query({ text: "%_\\ cOmP" })).total).toBe(1);
  expect((await query({ text: "' OR 1=1 --" })).total).toBe(0);
});

it("uses current interpretation for corrupt or unsupported scale snapshots", async () => {
  db.__addMood({ mood: 8, mood_scale_json: "broken" });
  db.__addMood({ mood: 8, mood_scale_json: '{"version":3,"min":0,"max":10,"lowerIsBetter":false}' });
  expect((await query({ minMood: 7 })).total).toBe(2);
});

it("orders equal timestamps by id across pages and matches full-range totals", async () => {
  for (let i = 0; i < 100; i++) db.__addMood({ timestamp: 1000 + Math.floor(i / 2) });
  const first = await getMoodsPaginated({ limit: 13, offset: 0 });
  const second = await getMoodsPaginated({ limit: 13, offset: 13 });
  expect(first.total).toBe(100);
  expect(first.hasMore).toBe(true);
  expect([...first.data, ...second.data].map(entry => entry.id)).toEqual((await getAllMoods()).slice(0, 26).map(entry => entry.id));
  const range = await getMoodsInRange(1010, 1020);
  expect(range).toEqual((await getAllMoods()).filter(entry => entry.timestamp >= 1010 && entry.timestamp <= 1020));
  expect((await query({ startDate: 1010, endDate: 1020 })).total).toBe(range.length);
});
