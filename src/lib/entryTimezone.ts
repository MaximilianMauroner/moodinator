import { UNREADABLE_TIMESTAMP } from "../../db/moods/serialization";
import type { MoodEntry } from "../../db/types";

type EntryTime = Pick<MoodEntry, "timestamp" | "utcOffsetMinutes">;

function localParts(entry: EntryTime) {
  const offset = entry.utcOffsetMinutes;
  const recorded = typeof offset === "number" && Number.isInteger(offset) && Math.abs(offset) <= 840;
  const date = new Date(entry.timestamp - (recorded ? offset * 60_000 : 0));
  return recorded
    ? [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCDay()]
    : [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getDay()];
}

/**
 * Whether the entry has a date that can be placed on a calendar.
 *
 * A row whose stored timestamp cannot be read is kept at the epoch so it reads
 * the same every time. That is right for storage and for the list, where it
 * sorts to the bottom and shows a date nobody mistakes for real data. It is
 * wrong for anything that spans a date range: one such row makes "All history"
 * start in 1970, and the trend chart then draws 20,000 empty days and squeezes
 * the real history into its last pixels.
 */
export function hasKnownDate(entry: EntryTime): boolean {
  return entry.timestamp !== UNREADABLE_TIMESTAMP;
}

export function getEntryLocalDayKey(entry: EntryTime): string {
  const [year, month, day] = localParts(entry);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getEntryLocalHour(entry: EntryTime): number {
  return localParts(entry)[3];
}

export function getEntryLocalWeekday(entry: EntryTime): number {
  return localParts(entry)[4];
}

/** Locale-aware clock time in the entry's captured offset, without rebucketing it. */
export function getEntryLocalTimeLabel(entry: EntryTime): string {
  const offset = entry.utcOffsetMinutes;
  const recorded = typeof offset === "number" && Number.isInteger(offset) && Math.abs(offset) <= 840;
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    ...(recorded ? { timeZone: "UTC" } : {}),
  }).format(new Date(entry.timestamp - (recorded ? offset * 60_000 : 0)));
}
