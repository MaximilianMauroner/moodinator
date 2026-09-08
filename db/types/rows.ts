/**
 * Database row type definitions
 * These types represent the raw data returned from SQLite queries
 * before being transformed into application types.
 */

/**
 * Raw mood row from the moods table
 */
export interface MoodRow {
  id: number;
  mood: number;
  note: string | null;
  timestamp: number;
  emotions: string; // JSON string
  context_tags: string; // JSON string
  energy: number | null;
  mood_scale_json: string | null; // JSON string snapshot of the Mood Scale used at entry creation
  utc_offset_minutes?: number | null;
  based_on_entry_id: number | null; // Reference to copied entry
}

/**
 * Raw emotion row from the emotions table
 */
export interface EmotionRow {
  id: number;
  name: string;
  category: "positive" | "negative" | "neutral";
}

/**
 * SQLite column info from PRAGMA table_info
 */
export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

/**
 * Count result from COUNT(*) queries
 */
export interface CountResult {
  count: number;
}

/**
 * Result from SQLite run operations
 */
export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

/**
 * Raw emotion item that could be a string or object (for migration)
 */
import type { EmotionEnergyBand } from "../../domain/entrySettings";

export type RawEmotionItem =
  | string
  | {
      name: string;
      category?: "positive" | "negative" | "neutral";
      energy?: EmotionEnergyBand;
    };

/**
 * Query parameters for SQLite operations
 */
export type QueryParam = string | number | null;
