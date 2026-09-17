import { UNREADABLE_TIMESTAMP } from "../../db/moods/serialization";
import type { MoodEntry } from "../../db/types";

type EntryTime = Pick<MoodEntry, "timestamp" | "utcOffsetMinutes">;

type EntryDateStyle = "history" | "detail";

export type EntryLocalDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

function hasRecordedOffset(entry: EntryTime): entry is EntryTime & { utcOffsetMinutes: number } {
  const offset = entry.utcOffsetMinutes;
  return typeof offset === "number" && Number.isInteger(offset) && Math.abs(offset) <= 840;
}

function getDisplayDate(entry: EntryTime): { date: Date; recordedOffset: boolean } | null {
  if (!Number.isFinite(entry.timestamp) || entry.timestamp === UNREADABLE_TIMESTAMP) {
    return null;
  }

  const recordedOffset = hasRecordedOffset(entry);
  const date = new Date(
    entry.timestamp - (recordedOffset ? entry.utcOffsetMinutes * 60_000 : 0),
  );

  return Number.isNaN(date.getTime()) ? null : { date, recordedOffset };
}

function localParts(entry: EntryTime): [number, number, number, number, number] | null {
  const display = getDisplayDate(entry);
  if (!display) {
    return null;
  }

  const { date, recordedOffset } = display;
  return recordedOffset
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
  return Number.isFinite(entry.timestamp) && entry.timestamp !== UNREADABLE_TIMESTAMP;
}

export function getEntryLocalDayKey(entry: EntryTime): string | null {
  const parts = localParts(entry);
  if (!parts) {
    return null;
  }

  const [year, month, day] = parts;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatEntryDate(
  entry: EntryTime,
  options: Intl.DateTimeFormatOptions,
): string {
  const display = getDisplayDate(entry);
  if (!display) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(undefined, {
    ...options,
    ...(display.recordedOffset ? { timeZone: "UTC" } : {}),
  }).format(display.date);
}

/** Locale-aware date in the entry's captured offset, without rebucketing it. */
export function getEntryLocalDateLabel(
  entry: EntryTime,
  style: EntryDateStyle = "history",
): string {
  return formatEntryDate(
    entry,
    style === "detail"
      ? { weekday: "long", month: "long", day: "numeric", year: "numeric" }
      : { weekday: "short", month: "short", day: "numeric" },
  );
}

/**
 * Wall-clock parts for controls that edit an entry's date and time.
 *
 * This intentionally returns numeric parts instead of a YYYY-MM-DD string so
 * callers do not reparse a recorded day through a timezone-sensitive midnight.
 */
export function getEntryLocalDateParts(entry: EntryTime): EntryLocalDateParts | null {
  const display = getDisplayDate(entry);
  if (!display) {
    return null;
  }

  const date = display.date;
  return display.recordedOffset
    ? {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth(),
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds(),
        millisecond: date.getUTCMilliseconds(),
      }
    : {
        year: date.getFullYear(),
        month: date.getMonth(),
        day: date.getDate(),
        hour: date.getHours(),
        minute: date.getMinutes(),
        second: date.getSeconds(),
        millisecond: date.getMilliseconds(),
      };
}

export function getEntryLocalHour(entry: EntryTime): number | null {
  return localParts(entry)?.[3] ?? null;
}

export function getEntryLocalWeekday(entry: EntryTime): number | null {
  return localParts(entry)?.[4] ?? null;
}

/** Convert captured wall-clock parts back to an instant using UTC-minus-local offset. */
export function getTimestampFromEntryLocalDateParts(
  parts: EntryLocalDateParts,
  utcOffsetMinutes: number,
): number {
  const wallClock = new Date(0);
  wallClock.setUTCFullYear(parts.year, parts.month, parts.day);
  wallClock.setUTCHours(parts.hour, parts.minute, parts.second, parts.millisecond);
  return wallClock.getTime() + utcOffsetMinutes * 60_000;
}

/** Locale-aware clock time in the entry's captured offset, without rebucketing it. */
export function getEntryLocalTimeLabel(entry: EntryTime): string {
  const display = getDisplayDate(entry);
  if (!display) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    ...(display.recordedOffset ? { timeZone: "UTC" } : {}),
  }).format(display.date);
}
