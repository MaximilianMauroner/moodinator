import type { Emotion, MoodEntry, MoodEntryInput } from "../types";
import type { MoodRow, CountResult, QueryParam } from "../types/rows";
import { getDb } from "../client";
import { resolveDateRange, type MoodDateRange } from "./range";
import {
  normalizeInput,
  serializeArray,
  serializeEmotions,
  serializeLocation,
  toMoodEntry,
} from "./serialization";
import {
  deleteEmotion,
  linkEmotionsToMood,
  upsertEmotionCategory,
} from "./emotions";
import { parseEmotionItem } from "./emotionUtils";

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
      "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy, photos_json, location_json, voice_memos_json, based_on_entry_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
      mood,
      normalized.note,
      normalized.timestamp,
      serializeEmotions(normalized.emotions),
      serializeArray(normalized.contextTags),
      normalized.energy,
      serializeArray(normalized.photos),
      serializeLocation(normalized.location),
      serializeArray(normalized.voiceMemos),
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
      "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy, photos_json, location_json, voice_memos_json, based_on_entry_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
      entry.mood,
      normalized.note,
      normalized.timestamp,
      serializeEmotions(normalized.emotions),
      serializeArray(normalized.contextTags),
      normalized.energy,
      serializeArray(normalized.photos),
      serializeLocation(normalized.location),
      serializeArray(normalized.voiceMemos),
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
  await db.runAsync("UPDATE moods SET timestamp = ? WHERE id = ?;", timestamp, id);
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
  if (updates.photos !== undefined) {
    fields.push("photos_json = ?");
    params.push(serializeArray(updates.photos));
  }
  if (updates.location !== undefined) {
    fields.push("location_json = ?");
    params.push(serializeLocation(updates.location));
  }
  if (updates.voiceMemos !== undefined) {
    fields.push("voice_memos_json = ?");
    params.push(serializeArray(updates.voiceMemos));
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
  const rows = await db.getAllAsync<MoodRow>("SELECT * FROM moods ORDER BY timestamp DESC;");
  return rows.map(toMoodEntry);
}

export type PaginationOptions = {
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
  const { limit, offset } = options;

  const [rows, countResult] = await Promise.all([
    db.getAllAsync<MoodRow>(
      "SELECT * FROM moods ORDER BY timestamp DESC LIMIT ? OFFSET ?;",
      limit,
      offset
    ),
    db.getFirstAsync<CountResult>("SELECT COUNT(*) as count FROM moods;"),
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
  const db = await getDb();
  const target = emotionName.trim().toLowerCase();
  let updated = 0;

  await db.execAsync("BEGIN TRANSACTION;");
  try {
    const rows = await db.getAllAsync<Pick<MoodRow, "id" | "emotions">>(
      "SELECT id, emotions FROM moods;"
    );

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

      let changed = false;
      const next = normalized.map((emotion) => {
        if (emotion.name.trim().toLowerCase() === target) {
          if (emotion.category !== category) {
            changed = true;
          }
          return { ...emotion, category };
        }
        return emotion;
      });

      if (!changed) {
        continue;
      }

      await db.runAsync(
        "UPDATE moods SET emotions = ? WHERE id = ?;",
        serializeEmotions(next),
        row.id
      );
      updated += 1;
    }

    await upsertEmotionCategory(emotionName, category);
    await db.execAsync("COMMIT;");
    return { updated };
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }
}

export async function removeEmotionFromMoods(
  emotionName: string
): Promise<{ updated: number }> {
  const db = await getDb();
  const target = emotionName.trim().toLowerCase();
  let updated = 0;

  await db.execAsync("BEGIN TRANSACTION;");
  try {
    const rows = await db.getAllAsync<Pick<MoodRow, "id" | "emotions">>(
      "SELECT id, emotions FROM moods;"
    );

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

      const next = normalized.filter(
        (emotion) => emotion.name.trim().toLowerCase() !== target
      );

      if (next.length === normalized.length) {
        continue;
      }

      await db.runAsync(
        "UPDATE moods SET emotions = ? WHERE id = ?;",
        serializeEmotions(next),
        row.id
      );
      await linkEmotionsToMood(db, row.id, next);
      updated += 1;
    }

    await deleteEmotion(emotionName);
    await db.execAsync("COMMIT;");
    return { updated };
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }
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
    `SELECT * FROM moods ${whereClause} ORDER BY timestamp DESC;`,
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
    "SELECT * FROM moods WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC;",
    startDate,
    endDate
  );
  return rows.map(toMoodEntry);
}
