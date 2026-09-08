import { vi } from "vitest";
import { createMockDb } from "./mockClient";
import { getEntryLocalDayKey, getEntryLocalHour, getEntryLocalWeekday } from "../../src/lib/entryTimezone";
import { insertMoodEntry, updateMoodEntry, getMoodsByMonth, getMoodHistorySummary } from "../../db/moods/repository";
import { exportMoods, importMoods, importOldBackup } from "../../db/moods/importExport";

const db = createMockDb();
vi.mock("../../db/client", () => ({ getDb: vi.fn(async () => db) }));
beforeEach(() => db.__reset());

it("retains the captured day and hour across travel and DST offsets", () => {
  const timestamp = Date.parse("2026-03-29T23:30:00Z");
  expect(getEntryLocalDayKey({ timestamp, utcOffsetMinutes: -120 })).toBe("2026-03-30");
  expect(getEntryLocalHour({ timestamp, utcOffsetMinutes: -120 })).toBe(1);
  expect(getEntryLocalWeekday({ timestamp, utcOffsetMinutes: -120 })).toBe(1);
  expect(getEntryLocalDayKey({ timestamp, utcOffsetMinutes: 420 })).toBe("2026-03-29");
  expect(getEntryLocalHour({ timestamp, utcOffsetMinutes: 420 })).toBe(16);
});

it("uses device local time for legacy records", () => {
  const date = new Date(2026, 2, 29, 23, 30);
  expect(getEntryLocalDayKey({ timestamp: date.getTime() })).toBe("2026-03-29");
  expect(getEntryLocalHour({ timestamp: date.getTime(), utcOffsetMinutes: null })).toBe(23);
});

it("captures new offsets, preserves note edits, recaptures explicit timestamp edits", async () => {
  const timestamp = Date.parse("2026-03-29T23:30:00Z");
  const fresh = await insertMoodEntry({ mood: 2, timestamp });
  expect(fresh.utcOffsetMinutes).toBe(new Date(timestamp).getTimezoneOffset());
  const travel = await insertMoodEntry({ mood: 2, timestamp, utcOffsetMinutes: -120 });
  expect((await updateMoodEntry(travel.id, { note: "Changed" }))?.utcOffsetMinutes).toBe(-120);
  expect((await updateMoodEntry(travel.id, { note: "Same time", timestamp }))?.utcOffsetMinutes).toBe(-120);
  expect((await updateMoodEntry(travel.id, { timestamp: timestamp + 1000 }))?.utcOffsetMinutes)
    .toBe(new Date(timestamp + 1000).getTimezoneOffset());
});

it("roundtrips recorded and unknown offsets through exports and old-backup imports", async () => {
  const data = JSON.stringify([
    { mood: 2, timestamp: 1705320000000, utcOffsetMinutes: -345 },
    { mood: 7, timestamp: 1705320001000 },
  ]);
  await importMoods(data);
  const exported = await exportMoods();
  await importMoods(exported);
  expect(await exportMoods()).toBe(exported);
  db.__reset();
  await importOldBackup(exported);
  expect(await exportMoods()).toBe(exported);
  expect(db.__getMoods().map(row => row.utc_offset_minutes).sort()).toEqual([-345, null]);
});

it("calendar and summary include cross-boundary entries by captured local date", async () => {
  await insertMoodEntry({ mood: 2, timestamp: Date.parse("2026-03-31T23:30:00Z"), utcOffsetMinutes: -120 });
  await insertMoodEntry({ mood: 3, timestamp: Date.parse("2026-04-01T00:30:00Z"), utcOffsetMinutes: -120 });
  expect((await getMoodsByMonth(2026, 2)).size).toBe(0);
  expect((await getMoodsByMonth(2026, 3)).get(1)).toHaveLength(2);
  const summary = await getMoodHistorySummary();
  expect(summary.totalCount).toBe(2);
  expect(summary.days).toHaveLength(1);
  expect(getEntryLocalDayKey(summary.days[0])).toBe("2026-04-01");
});

it("formats clock labels using the saved offset and the user's locale", async () => {
  const { getEntryLocalTimeLabel } = await import("../../src/lib/entryTimezone");
  const timestamp = Date.parse("2026-03-29T23:30:00Z");
  expect(getEntryLocalTimeLabel({ timestamp, utcOffsetMinutes: -120 })).toBe(
    new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: "UTC" })
      .format(new Date("2026-03-30T01:30:00Z"))
  );
});
