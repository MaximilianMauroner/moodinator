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
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

/**
 * Inserts a new mood entry into the database.
 * @param mood - Mood value (integer)
 * @param note - Optional note
 * @returns Promise with the SQLite result
 */
export async function insertMood(mood: number, note?: string) {
    const db = await getDb();
    return db.runAsync(
        'INSERT INTO moods (mood, note) VALUES (?, ?);',
        mood,
        note ?? null
    );
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

// Ensure the moods table exists as soon as this module is loaded
void createMoodTable();