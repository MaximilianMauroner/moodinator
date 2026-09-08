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
