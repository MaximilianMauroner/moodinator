import * as SQLite from 'expo-sqlite';
import type { MoodEntry } from './types';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Opens the database if not already open.
 */
async function getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!db) {
        db = await SQLite.openDatabaseAsync('moodinator.db');
    }
    return db;
}

/**
 * Creates the 'moods' table if it does not exist.
 */
export async function createMoodTable() {
    const db = await getDb();
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS moods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mood INTEGER NOT NULL,
            note TEXT,
            timestamp DATETIME
        );
    `);
}

/**
 * Inserts a new mood entry into the database.
 * @param mood - Mood value (integer)
 * @param note - Optional note
 * @returns Promise with the SQLite result
 */
export async function insertMood(mood: number, note?: string): Promise<MoodEntry> {
    const db = await getDb();
    const result = await db.runAsync(
        'INSERT INTO moods (mood, note, timestamp) VALUES (?, ?, ?);',
        mood,
        note ?? null,
        new Date().getTime() // Use current timestamp
    );
    const inserted = await db.getFirstAsync('SELECT * FROM moods WHERE id = ?;', result.lastInsertRowId);
    return inserted as MoodEntry;
}

/**
 * Updates only the note of a mood entry by its ID and returns the updated mood entry.
 * @param id - The ID of the mood entry to update
 * @param note - The new note
 * @returns Promise resolving to the updated MoodEntry
 */
export async function updateMoodNote(id: number, note: string): Promise<MoodEntry | undefined> {
    const db = await getDb();
    await db.runAsync(
        'UPDATE moods SET note = ? WHERE id = ?;',
        note,
        id
    );
    const updated = await db.getFirstAsync('SELECT * FROM moods WHERE id = ?;', id);
    return updated as MoodEntry | undefined;
}

/**
 * Retrieves all mood entries, ordered by timestamp descending.
 * @returns Promise resolving to an array of MoodEntry
 */
export async function getAllMoods(): Promise<MoodEntry[]> {
    const db = await getDb();
    return db.getAllAsync('SELECT * FROM moods ORDER BY timestamp DESC;');
}

/**
 * Deletes a mood entry by its ID.
 * @param id - The ID of the mood entry to delete
 * @returns Promise with the SQLite result
 */
export async function deleteMood(id: number) {
    const db = await getDb();
    return db.runAsync('DELETE FROM moods WHERE id = ?;', id);
}

/**
 * Seeds the database with random mood entries (DEV only)
 */
export async function seedMoods() {
    if (!__DEV__) return;

    const db = await getDb();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365); // Go back 365 days

    for (let i = 0; i < 365; i++) {
        // Random number of entries per day (0-5)
        const entriesCount = Math.floor(Math.random() * 6);

        for (let j = 0; j < entriesCount; j++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);

            // Random time during the day
            currentDate.setHours(Math.floor(Math.random() * 24));
            currentDate.setMinutes(Math.floor(Math.random() * 60));

            // Random mood between 1 and 10
            const mood = Math.floor(Math.random() * 10) + 1;

            await db.runAsync(
                'INSERT INTO moods (mood, timestamp) VALUES (?, ?);',
                mood,
                currentDate.getTime()
            );
        }
    }
}

/**
 * Clears all mood entries from the database (DEV only)
 */
export async function clearMoods() {
    if (!__DEV__) return;
    const db = await getDb();
    await db.runAsync('DELETE FROM moods;');
}

/**
 * Retrieves mood entries grouped by day for charting with date range.
 */
export async function getMoodsForChart(): Promise<{ data: { date: string; avgMood: number }[]; dateRange: { start: number | null; end: number | null } }> {
    const db = await getDb();
    const result = await db.getAllAsync(`
        SELECT 
            date(datetime(timestamp/1000, 'unixepoch')) as date,
            avg(mood) as avgMood,
            min(timestamp) as firstEntry,
            max(timestamp) as lastEntry
        FROM moods 
        GROUP BY date
        ORDER BY date ASC;
    `) as { date: string; avgMood: number }[];

    const firstEntry = await db.getFirstAsync<{ first: number | null }>('SELECT MIN(timestamp) as first FROM moods;');
    const lastEntry = await db.getFirstAsync<{ last: number | null }>('SELECT MAX(timestamp) as last FROM moods;');

    return {
        data: result,
        dateRange: {
            start: firstEntry?.first ?? null,
            end: lastEntry?.last ?? null
        }
    };
}

/**
 * Retrieves mood entries grouped by a flexible time scale for charting with date range.
 */
export type TimeScale = 'hour' | 'day' | 'week' | 'month' | 'year';

export async function getMoodsForChartWithScale(scale: TimeScale = 'day'): Promise<ChartData> {
    const db = await getDb();

    const timeFormat = {
        hour: "strftime('%Y-%m-%d %H:00', datetime(timestamp/1000, 'unixepoch', 'localtime'))",
        day: "strftime('%Y-%m-%d', datetime(timestamp/1000, 'unixepoch', 'localtime'))",
        week: "strftime('%Y-W%W', datetime(timestamp/1000, 'unixepoch', 'localtime'))",
        month: "strftime('%Y-%m', datetime(timestamp/1000, 'unixepoch', 'localtime'))",
        year: "strftime('%Y', datetime(timestamp/1000, 'unixepoch', 'localtime'))"
    }[scale];

    // Modified query to show individual entries instead of averages
    const result = await db.getAllAsync<ChartDataPoint>(`
        WITH chart_data AS (
            SELECT 
                ${timeFormat} as date,
                mood as avgMood,  -- Use actual mood value instead of average
                timestamp as firstEntry,
                timestamp as lastEntry,
                1 as entryCount
            FROM moods 
            ORDER BY timestamp DESC
        )
        SELECT * FROM chart_data;
    `);

    const dateRange = result.reduce((acc, curr) => ({
        start: acc.start === null ? curr.firstEntry : Math.min(acc.start, curr.firstEntry),
        end: acc.end === null ? curr.lastEntry : Math.max(acc.end, curr.lastEntry)
    }), { start: null as number | null, end: null as number | null });

    return { data: result, dateRange };
}

/**
 * Retrieves detailed mood entries for a specific time point.
 * @param date - The date string of the time point
 * @param scale - The time scale (hour, day, week, month, year)
 * @returns Promise resolving to an array of MoodEntry
 */
export async function getMoodsForTimePoint(date: string, scale: TimeScale): Promise<MoodEntry[]> {
    const db = await getDb();
    const timeFormat = {
        hour: "strftime('%Y-%m-%d %H:00', datetime(timestamp/1000, 'unixepoch', 'localtime'))",
        day: "strftime('%Y-%m-%d', datetime(timestamp/1000, 'unixepoch', 'localtime'))",
        week: "strftime('%Y-W%W', datetime(timestamp/1000, 'unixepoch', 'localtime'))",
        month: "strftime('%Y-%m', datetime(timestamp/1000, 'unixepoch', 'localtime'))",
        year: "strftime('%Y', datetime(timestamp/1000, 'unixepoch', 'localtime'))"
    }[scale];

    return db.getAllAsync(`
        SELECT * FROM moods 
        WHERE ${timeFormat} = ?
        ORDER BY timestamp DESC;
    `, date);
}

// Ensure the moods table exists as soon as this module is loaded
void createMoodTable();