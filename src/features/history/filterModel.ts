import { moodScale } from "@/constants/moodScale";
import type { MoodHistoryFilters } from "@/services/moodService";

/**
 * Pure model behind the history filters. The sheet and the active-filter chip
 * bar both read from here, so the labels stay identical in both places.
 *
 * Mood is inverted everywhere in this app: 0 is the best day, 10 the worst.
 */

export const MOOD_VALUES: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export type DatePresetId = "any" | "7d" | "30d" | "90d" | "year" | "custom";

const DATE_PRESET_LABELS = {
  any: "Any time",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  year: "This year",
  custom: "Custom",
} as const satisfies Record<DatePresetId, string>;

export const DATE_PRESETS = (
  ["any", "7d", "30d", "90d", "year", "custom"] as const
).map((id) => ({ id, label: DATE_PRESET_LABELS[id] }));

export type DateRangeFilter = Pick<MoodHistoryFilters, "startDate" | "endDate">;

export type MoodRange = { min: number; max: number };

/** A range being picked: `anchor` is set while the second bound is pending. */
export type MoodRangeDraft = { range: MoodRange | null; anchor: number | null };

export const EMPTY_MOOD_DRAFT: MoodRangeDraft = { range: null, anchor: null };

export type FilterChip = { id: string; label: string };

const EMOTION_CHIP_PREFIX = "emotion:";
const CONTEXT_CHIP_PREFIX = "context:";

export function startOfDay(date: Date): number {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

export function endOfDay(date: Date): number {
  const day = new Date(date);
  day.setHours(23, 59, 59, 999);
  return day.getTime();
}

function daysBefore(now: Date, days: number): Date {
  const day = new Date(now);
  day.setDate(day.getDate() - days);
  return day;
}

export function datePresetRange(id: DatePresetId, now: Date): DateRangeFilter {
  switch (id) {
    case "7d":
      return { startDate: startOfDay(daysBefore(now, 6)), endDate: endOfDay(now) };
    case "30d":
      return { startDate: startOfDay(daysBefore(now, 29)), endDate: endOfDay(now) };
    case "90d":
      return { startDate: startOfDay(daysBefore(now, 89)), endDate: endOfDay(now) };
    case "year":
      return {
        startDate: startOfDay(new Date(now.getFullYear(), 0, 1)),
        endDate: endOfDay(new Date(now.getFullYear(), 11, 31)),
      };
    default:
      return {};
  }
}

/** Dates the custom pickers start on when no range is stored yet. */
export function defaultCustomRange(now: Date): { start: Date; end: Date } {
  return { start: daysBefore(now, 29), end: new Date(now) };
}

/** Which preset chip a stored range belongs to, so reopening keeps the choice. */
export function matchDatePreset(range: DateRangeFilter, now: Date): DatePresetId {
  if (range.startDate === undefined && range.endDate === undefined) return "any";
  for (const preset of DATE_PRESETS) {
    if (preset.id === "any" || preset.id === "custom") continue;
    const candidate = datePresetRange(preset.id, now);
    if (
      candidate.startDate === range.startDate &&
      candidate.endDate === range.endDate
    )
      return preset.id;
  }
  return "custom";
}

export function formatDay(value: number, now: Date): string {
  const date = new Date(value);
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (date.getFullYear() !== now.getFullYear()) options.year = "numeric";
  return date.toLocaleDateString(undefined, options);
}

export function moodLabel(value: number): string {
  return moodScale[value]?.label ?? String(value);
}

export function moodRangeSummary(range: MoodRange | null): string {
  if (!range) return "Any mood";
  if (range.min === range.max) return `Mood ${range.min} · ${moodLabel(range.min)}`;
  return `Mood ${range.min}–${range.max} · ${moodLabel(range.min)} to ${moodLabel(range.max)}`;
}

/**
 * One tap on the mood row. The first tap sets a single value and arms the
 * anchor, the next tap completes the range, and tapping the lone selected
 * value again clears it.
 */
export function pickMoodValue(draft: MoodRangeDraft, value: number): MoodRangeDraft {
  if (draft.anchor !== null)
    return {
      range: {
        min: Math.min(draft.anchor, value),
        max: Math.max(draft.anchor, value),
      },
      anchor: null,
    };
  if (draft.range && draft.range.min === value && draft.range.max === value)
    return EMPTY_MOOD_DRAFT;
  return { range: { min: value, max: value }, anchor: value };
}

function dateFilterLabel(range: DateRangeFilter, now: Date): string {
  const preset = matchDatePreset(range, now);
  if (preset !== "custom") return DATE_PRESET_LABELS[preset];
  const start =
    range.startDate === undefined ? null : formatDay(range.startDate, now);
  const end = range.endDate === undefined ? null : formatDay(range.endDate, now);
  if (start && end) return `${start} – ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return DATE_PRESET_LABELS.any;
}

function moodFilterLabel(filters: MoodHistoryFilters): string {
  const { minMood, maxMood } = filters;
  if (minMood !== undefined && maxMood !== undefined)
    return minMood === maxMood ? `Mood ${minMood}` : `Mood ${minMood}–${maxMood}`;
  if (minMood !== undefined) return `Mood ${minMood} or worse`;
  if (maxMood !== undefined) return `Mood ${maxMood} or better`;
  return "Any mood";
}

/** Active filters as removable chips, in the order they read best. */
export function describeFilters(
  filters: MoodHistoryFilters,
  now: Date,
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.startDate !== undefined || filters.endDate !== undefined)
    chips.push({ id: "date", label: dateFilterLabel(filters, now) });
  if (filters.minMood !== undefined || filters.maxMood !== undefined)
    chips.push({ id: "mood", label: moodFilterLabel(filters) });
  for (const name of filters.emotions ?? [])
    chips.push({ id: `${EMOTION_CHIP_PREFIX}${name}`, label: name });
  for (const name of filters.contexts ?? [])
    chips.push({ id: `${CONTEXT_CHIP_PREFIX}${name}`, label: name });
  if (filters.text) chips.push({ id: "text", label: `“${filters.text}”` });
  return chips;
}

/**
 * A full preset list runs to dozens of names, which buries the rest of the
 * sheet. Show a couple of rows, keep every selected name visible, and report
 * how many are held back.
 */
export const COLLAPSED_CHOICE_LIMIT = 10;

export function collapseChoices(
  all: readonly string[],
  selected: readonly string[],
  expanded: boolean,
  limit: number = COLLAPSED_CHOICE_LIMIT,
): { visible: string[]; hidden: number } {
  if (expanded || all.length <= limit) return { visible: [...all], hidden: 0 };
  const chosen = all.filter((name) => selected.includes(name));
  const rest = all.filter((name) => !selected.includes(name));
  const visible = [...chosen, ...rest].slice(0, Math.max(limit, chosen.length));
  return { visible, hidden: all.length - visible.length };
}

/**
 * Preset names first, then names only found in older entries, then anything
 * already selected. Every name a saved entry can carry stays reachable.
 */
export function mergeFilterChoices(
  presets: readonly string[],
  history: readonly string[],
  selected: readonly string[],
): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  const sortedHistory = [...history].sort((a, b) => a.localeCompare(b));
  for (const list of [presets, sortedHistory, selected])
    for (const name of list)
      if (!seen.has(name)) {
        seen.add(name);
        merged.push(name);
      }
  return merged;
}

function withoutName(
  names: string[] | undefined,
  removed: string,
): string[] | undefined {
  const remaining = (names ?? []).filter((name) => name !== removed);
  return remaining.length ? remaining : undefined;
}

export function removeFilter(
  filters: MoodHistoryFilters,
  chipId: string,
): MoodHistoryFilters {
  const next = { ...filters };
  if (chipId === "date") {
    delete next.startDate;
    delete next.endDate;
  } else if (chipId === "mood") {
    delete next.minMood;
    delete next.maxMood;
  } else if (chipId === "text") {
    delete next.text;
  } else if (chipId.startsWith(EMOTION_CHIP_PREFIX)) {
    const emotions = withoutName(
      next.emotions,
      chipId.slice(EMOTION_CHIP_PREFIX.length),
    );
    if (emotions) next.emotions = emotions;
    else delete next.emotions;
  } else if (chipId.startsWith(CONTEXT_CHIP_PREFIX)) {
    const contexts = withoutName(
      next.contexts,
      chipId.slice(CONTEXT_CHIP_PREFIX.length),
    );
    if (contexts) next.contexts = contexts;
    else delete next.contexts;
  }
  return next;
}
