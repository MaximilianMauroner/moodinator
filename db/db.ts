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
 * Inserts a new mood entry with all its fields into the database.
 * @param entry - MoodEntry object containing all fields
 * @returns Promise with the inserted MoodEntry
 */
export async function insertMoodEntry(entry: MoodEntry): Promise<MoodEntry> {
    const db = await getDb();
    const result = await db.runAsync(
        'INSERT INTO moods (mood, note, timestamp) VALUES (?, ?, ?);',
        entry.mood,
        entry.note ?? null,
        entry.timestamp
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
    const days = 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days); // Go back 365 days

    for (let i = 0; i < days; i++) {
        // Random number of entries per day (0-9)
        const entriesCount = Math.floor(Math.random() * 10);

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

// Ensure the moods table exists as soon as this module is loaded
void createMoodTable();

/**
 * Retrieves the total count of mood entries in the database.
 * @returns Promise resolving to the count of mood entries
 */
export async function getMoodCount(): Promise<number> {
    const db = await getDb();
    const result = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM moods;');
    return result?.count ?? 0;
}

/**
 * Exports all mood entries to a JSON string
 * @returns Promise resolving to a JSON string of all mood entries
 */
export async function exportMoods(): Promise<string> {
    const moods = await getAllMoods();
    return JSON.stringify(moods);
}

/**
 * Imports mood entries from a JSON string
 * @param jsonData - JSON string containing mood entries
 * @returns Promise resolving to the number of imported entries
 */
export async function importMoods(jsonData: string): Promise<number> {
    try {
        const moods = JSON.parse(jsonData) as MoodEntry[];
        const db = await getDb();

        for (const mood of moods) {
            await db.runAsync(
                'INSERT INTO moods (mood, note, timestamp) VALUES (?, ?, ?);',
                mood.mood,
                mood.note,
                mood.timestamp
            );
        }

        return moods.length;
    } catch (error) {
        console.error('Error importing moods:', error);
        throw new Error('Invalid mood data format');
    }
}

