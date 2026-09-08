import { getEntryLocalDayKey } from "../../src/lib/entryTimezone";
import type { Emotion, MoodEntry, MoodEntryInput } from "../types";
import type { MoodRow, CountResult, QueryParam } from "../types/rows";
import { getDb } from "../client";
import { resolveDateRange, type MoodDateRange } from "./range";
import {
  normalizeInput,
  sanitizeUtcOffset,
  serializeArray,
  serializeEmotions,
  serializeMoodScale,
  toMoodEntry,
} from "./serialization";
import {
  linkEmotionsToMood,
  upsertEmotionCategory,
} from "./emotions";
import { parseEmotionItem } from "./emotionUtils";
import { isEmotionEnergyBand } from "../../domain/entrySettings";

export async function insertMood(
  mood: number,
  note?: string,
  metadata?: Omit<MoodEntryInput, "mood" | "note">
): Promise<MoodEntry> {
  const db = await getDb();
  const normalized = normalizeInput({
    mood,
    note: note ?? null,
    ...metadata,
  });

  await db.execAsync("BEGIN TRANSACTION;");
  try {
    const result = await db.runAsync(
      "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy, mood_scale_json, utc_offset_minutes, based_on_entry_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);",
      mood,
      normalized.note,
      normalized.timestamp,
      serializeEmotions(normalized.emotions),
      serializeArray(normalized.contextTags),
      normalized.energy,
      serializeMoodScale(normalized.moodScale),
      normalized.utcOffsetMinutes,
      normalized.basedOnEntryId
    );

    if (normalized.emotions && normalized.emotions.length > 0) {
      await linkEmotionsToMood(db, result.lastInsertRowId, normalized.emotions);
    }

    await db.execAsync("COMMIT;");

    const inserted = await db.getFirstAsync<MoodRow>(
      "SELECT * FROM moods WHERE id = ?;",
      result.lastInsertRowId
    );
    return toMoodEntry(inserted!);
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }
}

export async function insertMoodEntry(entry: MoodEntryInput): Promise<MoodEntry> {
  const db = await getDb();
  const normalized = normalizeInput(entry);

  await db.execAsync("BEGIN TRANSACTION;");
  try {
    const result = await db.runAsync(
      "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy, mood_scale_json, utc_offset_minutes, based_on_entry_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);",
      entry.mood,
      normalized.note,
      normalized.timestamp,
      serializeEmotions(normalized.emotions),
      serializeArray(normalized.contextTags),
      normalized.energy,
      serializeMoodScale(normalized.moodScale),
      normalized.utcOffsetMinutes,
      normalized.basedOnEntryId
    );

    if (normalized.emotions && normalized.emotions.length > 0) {
      await linkEmotionsToMood(db, result.lastInsertRowId, normalized.emotions);
    }

    await db.execAsync("COMMIT;");

    const inserted = await db.getFirstAsync<MoodRow>(
      "SELECT * FROM moods WHERE id = ?;",
      result.lastInsertRowId
    );
    return toMoodEntry(inserted!);
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }
}

export async function hasMoodBeenLoggedToday(): Promise<boolean> {
  const db = await getDb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const result = await db.getFirstAsync<CountResult>(
    "SELECT COUNT(*) as count FROM moods WHERE timestamp >= ? AND timestamp <= ?;",
    todayStart.getTime(),
    todayEnd.getTime()
  );

  return (result?.count ?? 0) > 0;
}

export async function updateMoodNote(
  id: number,
  note: string
): Promise<MoodEntry | undefined> {
  const db = await getDb();
  await db.runAsync("UPDATE moods SET note = ? WHERE id = ?;", note, id);
  const updated = await db.getFirstAsync<MoodRow>(
    "SELECT * FROM moods WHERE id = ?;",
    id
  );
  return updated ? toMoodEntry(updated) : undefined;
}

export async function updateMoodTimestamp(
  id: number,
  timestamp: number
): Promise<MoodEntry | undefined> {
  const db = await getDb();
  await db.runAsync("UPDATE moods SET utc_offset_minutes = CASE WHEN timestamp = ? THEN utc_offset_minutes ELSE ? END, timestamp = ? WHERE id = ?;", timestamp, new Date(timestamp).getTimezoneOffset(), timestamp, id);
  const updated = await db.getFirstAsync<MoodRow>(
    "SELECT * FROM moods WHERE id = ?;",
    id
  );
  return updated ? toMoodEntry(updated) : undefined;
}

export async function updateMoodEntry(
  id: number,
  updates: Partial<MoodEntryInput & { mood: number }>
): Promise<MoodEntry | undefined> {
  const db = await getDb();
  const fields: string[] = [];
  const params: QueryParam[] = [];
  let updateEmotions = false;
  let emotionsToUpdate: Emotion[] = [];

  if (typeof updates.mood === "number") {
    fields.push("mood = ?");
    params.push(updates.mood);
  }
  if (updates.note !== undefined) {
    fields.push("note = ?");
    params.push(updates.note);
  }
  if (updates.timestamp !== undefined) {
    fields.push("timestamp = ?");
    params.push(updates.timestamp);
    if (updates.utcOffsetMinutes === undefined) {
      fields.push("utc_offset_minutes = CASE WHEN timestamp = ? THEN utc_offset_minutes ELSE ? END");
      params.push(updates.timestamp, new Date(updates.timestamp).getTimezoneOffset());
    } else {
      fields.push("utc_offset_minutes = ?");
      params.push(sanitizeUtcOffset(updates.utcOffsetMinutes));
    }
  }
  if (updates.emotions !== undefined) {
    fields.push("emotions = ?");
    params.push(serializeEmotions(updates.emotions));
    updateEmotions = true;
    emotionsToUpdate = updates.emotions;
  }
  if (updates.contextTags !== undefined) {
    fields.push("context_tags = ?");
    params.push(serializeArray(updates.contextTags));
  }
  if (updates.energy !== undefined) {
    fields.push("energy = ?");
    params.push(
      updates.energy === null
        ? null
        : Math.min(10, Math.max(0, Math.round(updates.energy)))
    );
  }
  if (updates.moodScale !== undefined) {
    fields.push("mood_scale_json = ?");
    params.push(serializeMoodScale(updates.moodScale));
  }
  if (updates.basedOnEntryId !== undefined) {
    fields.push("based_on_entry_id = ?");
    params.push(updates.basedOnEntryId);
  }

  if (!fields.length) {
    const current = await db.getFirstAsync<MoodRow>("SELECT * FROM moods WHERE id = ?;", id);
    return current ? toMoodEntry(current) : undefined;
  }

  await db.execAsync("BEGIN TRANSACTION;");
  try {
    await db.runAsync(
      `UPDATE moods SET ${fields.join(", ")} WHERE id = ?;`,
      ...params,
      id
    );

    if (updateEmotions) {
      await linkEmotionsToMood(db, id, emotionsToUpdate);
    }

    await db.execAsync("COMMIT;");
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }

  const updated = await db.getFirstAsync<MoodRow>(
    "SELECT * FROM moods WHERE id = ?;",
    id
  );
  return updated ? toMoodEntry(updated) : undefined;
}

export async function getAllMoods(): Promise<MoodEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MoodRow>("SELECT * FROM moods ORDER BY timestamp DESC, id DESC;");
  return rows.map(toMoodEntry);
}

export async function getLatestMood(): Promise<MoodEntry | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<MoodRow>(
    "SELECT * FROM moods ORDER BY timestamp DESC, id DESC LIMIT 1;"
  );
  return row ? toMoodEntry(row) : null;
}

export type MoodHistoryFilters = {
  text?: string;
  minMood?: number;
  maxMood?: number;
  emotions?: string[];
  contexts?: string[];
  startDate?: number;
  endDate?: number;
};

export type PaginationOptions = {
  filters?: MoodHistoryFilters;
  limit: number;
  offset: number;
};

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  hasMore: boolean;
};

export async function getMoodsPaginated(
  options: PaginationOptions
): Promise<PaginatedResult<MoodEntry>> {
  const db = await getDb();
  const { limit, offset, filters = {} } = options;
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(offset) || offset < 0) {
    throw new Error("Pagination requires a positive limit and nonnegative offset");
  }
  const conditions: string[] = [];
  const params: QueryParam[] = [];
  if (filters.text) {
    conditions.push("note LIKE ? ESCAPE '\\' COLLATE NOCASE");
    params.push(`%${filters.text.replace(/[\\%_]/g, "\\$&")}%`);
  }
  // Match supported legacy snapshots only, just as deserialization does.
  const scale = "CASE WHEN json_valid(mood_scale_json) THEN mood_scale_json ELSE '{}' END";
  const interpretedMood = `CASE WHEN json_extract(${scale}, '$.version') = 2
    AND json_extract(${scale}, '$.min') = 0 AND json_extract(${scale}, '$.max') = 10
    AND json_type(${scale}, '$.lowerIsBetter') = 'false'
    THEN 10 - min(10, max(0, mood)) ELSE min(10, max(0, mood)) END`;
  for (const [value, expression] of [
    [filters.minMood, `${interpretedMood} >= ?`],
    [filters.maxMood, `${interpretedMood} <= ?`],
    [filters.startDate, "timestamp >= ?"],
    [filters.endDate, "timestamp <= ?"],
  ] as const) {
    if (value !== undefined) {
      conditions.push(expression);
      params.push(value);
    }
  }
  for (const emotion of filters.emotions ?? []) {
    conditions.push(`EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(emotions) THEN emotions ELSE '[]' END) AS item
      WHERE (CASE WHEN item.type = 'text' THEN item.value ELSE json_extract(item.value, '$.name') END) = ? COLLATE NOCASE)`);
    params.push(emotion);
  }
  for (const context of filters.contexts ?? []) {
    conditions.push(`EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(context_tags) THEN context_tags ELSE '[]' END) AS item
      WHERE item.type = 'text' AND item.value = ? COLLATE NOCASE)`);
    params.push(context);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows, countResult] = await Promise.all([
    db.getAllAsync<MoodRow>(
      `SELECT * FROM moods ${where} ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?;`,
      ...params,
      limit,
      offset
    ),
    db.getFirstAsync<CountResult>(`SELECT COUNT(*) as count FROM moods ${where};`, ...params),
  ]);

  const total = countResult?.count ?? 0;
  const data = rows.map(toMoodEntry);

  return {
    data,
    total,
    hasMore: offset + data.length < total,
  };
}

export async function deleteMood(id: number) {
  const db = await getDb();
  return await db.runAsync("DELETE FROM moods WHERE id = ?;", id);
}

export async function getMoodCount(): Promise<number> {
  const db = await getDb();
  const result = await db.getFirstAsync<CountResult>("SELECT COUNT(*) as count FROM moods");
  return result?.count ?? 0;
}

export async function updateEmotionCategoryInMoods(
  emotionName: string,
  category: Emotion["category"]
): Promise<{ updated: number }> {
  await upsertEmotionCategory(emotionName, category);
  return { updated: 0 };
}

export async function getEmotionNamesFromMoods(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Pick<MoodRow, "emotions">>(
    "SELECT emotions FROM moods;"
  );
  const seen = new Map<string, string>();

  for (const row of rows) {
    const rawEmotions = row.emotions;
    if (!rawEmotions || rawEmotions === "[]") {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawEmotions);
    } catch {
      continue;
    }

    if (!Array.isArray(parsed)) {
      continue;
    }

    const normalized = parsed
      .map(parseEmotionItem)
      .filter((item): item is Emotion => item !== null);

    for (const emotion of normalized) {
      const key = emotion.name.trim().toLowerCase();
      if (!key || seen.has(key)) {
        continue;
      }
      seen.set(key, emotion.name.trim());
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

function toHistoryEmotion(item: unknown): Emotion | null {
  if (typeof item === "string") {
    const name = item.trim();
    return name ? { name, category: "neutral" } : null;
  }

  if (typeof item !== "object" || item === null) {
    return null;
  }

  const raw = item as Record<string, unknown>;
  if (typeof raw.name !== "string") {
    return null;
  }

  const name = raw.name.trim();
  if (!name) {
    return null;
  }

  const category =
    raw.category === "positive" ||
    raw.category === "negative" ||
    raw.category === "neutral"
      ? raw.category
      : "neutral";

  return isEmotionEnergyBand(raw.energy)
    ? { name, category, energy: raw.energy }
    : { name, category };
}

function parseHistoryEmotions(value: unknown): Emotion[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map(toHistoryEmotion)
    .filter((emotion): emotion is Emotion => emotion !== null);
}

function parseHistoryContextTags(value: unknown): string[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function getEmotionsFromMoods(): Promise<Emotion[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Pick<MoodRow, "emotions">>(
    "SELECT emotions FROM moods ORDER BY timestamp DESC, id DESC;"
  );
  const seen = new Map<string, Emotion>();

  for (const row of rows) {
    for (const emotion of parseHistoryEmotions(row.emotions)) {
      const key = emotion.name.trim().toLowerCase();
      if (!key || seen.has(key)) {
        continue;
      }
      seen.set(key, emotion);
    }
  }

  return Array.from(seen.values());
}

export async function getContextTagsFromMoods(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Pick<MoodRow, "context_tags">>(
    "SELECT context_tags FROM moods ORDER BY timestamp DESC, id DESC;"
  );
  const seen = new Map<string, string>();

  for (const row of rows) {
    for (const tag of parseHistoryContextTags(row.context_tags)) {
      const key = tag.toLowerCase();
      if (!key || seen.has(key)) {
        continue;
      }
      seen.set(key, tag);
    }
  }

  return Array.from(seen.values());
}

export async function getMoodsWithinRange(
  range?: MoodDateRange
): Promise<MoodEntry[]> {
  const db = await getDb();
  const { startDate, endDate } = resolveDateRange(range);
  const conditions: string[] = [];
  const params: QueryParam[] = [];

  if (typeof startDate === "number") {
    conditions.push("timestamp >= ?");
    params.push(startDate);
  }
  if (typeof endDate === "number") {
    conditions.push("timestamp <= ?");
    params.push(endDate);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await db.getAllAsync<MoodRow>(
    `SELECT * FROM moods ${whereClause} ORDER BY timestamp DESC, id DESC;`,
    ...params
  );
  return rows.map(toMoodEntry);
}

/**
 * Get moods in a specific timestamp range (optimized for index usage)
 * @param startDate - Start timestamp in milliseconds
 * @param endDate - End timestamp in milliseconds
 */
export async function getMoodsInRange(
  startDate: number,
  endDate: number
): Promise<MoodEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MoodRow>(
    "SELECT * FROM moods WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC, id DESC;",
    startDate,
    endDate
  );
  return rows.map(toMoodEntry);
}

/**
 * Get moods grouped by day for a specific month
 * @param year - The year (e.g., 2024)
 * @param month - The month (0-11, where 0 is January)
 * @returns Map of day number (1-31) to array of mood entries for that day
 */
export async function getMoodsByMonth(
  year: number,
  month: number
): Promise<Map<number, MoodEntry[]>> {
  const db = await getDb();

  // Get the first and last day of the month
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  const rows = await db.getAllAsync<MoodRow>(
    "SELECT * FROM moods WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC;",
    Date.UTC(year, month, 1) - 14 * 60 * 60 * 1000,
    Date.UTC(year, month + 1, 1) + 14 * 60 * 60 * 1000
  );

  const moodsByDay = new Map<number, MoodEntry[]>();

  for (const row of rows) {
    const entry = toMoodEntry(row);
    const key = getEntryLocalDayKey(entry);
    if (!key.startsWith(`${monthKey}-`)) {
      continue;
    }
    const day = Number(key.slice(-2));

    const existing = moodsByDay.get(day) || [];
    existing.push(entry);
    moodsByDay.set(day, existing);
  }

  return moodsByDay;
}

/** Compact full-history facts without loading notes, tags or every entry. */
export async function getMoodHistorySummary(): Promise<{
  totalCount: number;
  oldestTimestamp: number | null;
  days: { timestamp: number; utcOffsetMinutes: number | null }[];
}> {
  const db = await getDb();
  const [summary, days] = await Promise.all([
    db.getFirstAsync<{ count: number; oldest: number | null }>(
      "SELECT COUNT(*) AS count, MIN(timestamp) AS oldest FROM moods;"
    ),
    db.getAllAsync<{ timestamp: number; utcOffsetMinutes: number | null }>(`
      SELECT timestamp, utc_offset_minutes AS utcOffsetMinutes FROM moods
      GROUP BY CASE WHEN utc_offset_minutes IS NULL
        THEN date(timestamp / 1000.0, 'unixepoch', 'localtime')
        ELSE date(timestamp / 1000.0 - utc_offset_minutes * 60, 'unixepoch') END;
    `),
  ]);
  return {
    totalCount: summary?.count ?? 0,
    oldestTimestamp: summary?.oldest ?? null,
    days,
  };
}
