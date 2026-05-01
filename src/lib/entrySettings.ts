/**
 * Pure defaults and parsing for entry settings.
 *
 * This module has no side effects: no AsyncStorage reads or writes.
 * It exports domain types, default values, and parsing functions.
 * All storage I/O belongs in settingsStore (via shared/storage/asyncStorage).
 *
 * Note: therapyExportPrefs are intentionally absent from settingsStore — they
 * are managed locally by therapy-export.tsx which is the only subscriber.
 * Storage helpers for that screen live in src/lib/therapyExportPrefs.ts.
 */

import type { Emotion } from "../../db/types";

// Emotion list informed by:
// - Ekman's 6 basic emotions (anger, disgust, fear, happiness, sadness, surprise)
// - Plutchik's wheel of 8 primary emotions (joy, trust, fear, surprise, sadness, disgust, anger, anticipation)
// - Cowen & Keltner (2017, PNAS) – 27 self-reported emotion categories
// - PANAS-X clinical affect schedule (Watson & Clark, 1994)
// - DBT emotion regulation skills list (Linehan)
// - Shaver et al. (1987) prototypical emotion families
// Goal: 40 emotions covering the full everyday range with therapy-useful
// granularity. Each entry is meaningfully distinct on either valence,
// arousal, social orientation, or clinical signal — no synonym pairs.
export const DEFAULT_EMOTIONS: Emotion[] = [
    // ── Positive (15) ─────────────────────────────────────────────────────────
    { name: "Affectionate", category: "positive" },  // warmth toward others (love-out)
    { name: "Amused",       category: "positive" },  // humour / playfulness (Cowen & Keltner)
    { name: "Awe",          category: "positive" },  // transcendent wonder (Cowen & Keltner)
    { name: "Confident",    category: "positive" },  // self-assurance (PANAS-X)
    { name: "Content",      category: "positive" },  // low-arousal satisfaction
    { name: "Energetic",    category: "positive" },  // high-arousal vitality
    { name: "Excited",      category: "positive" },  // high-arousal anticipation / joy
    { name: "Grateful",     category: "positive" },  // appreciation (clinically protective)
    { name: "Happy",        category: "positive" },  // Ekman core
    { name: "Hopeful",      category: "positive" },  // future-oriented optimism (key in CBT)
    { name: "Inspired",     category: "positive" },  // creative spark (PANAS-X)
    { name: "Loved",        category: "positive" },  // feeling cared for (love-in; distinct from Affectionate)
    { name: "Motivated",    category: "positive" },  // drive / agency
    { name: "Proud",        category: "positive" },  // self-directed positive appraisal
    { name: "Relaxed",      category: "positive" },  // post-stress relief / serenity

    // ── Negative (20) ─────────────────────────────────────────────────────────
    { name: "Angry",        category: "negative" },  // Ekman core
    { name: "Anxious",      category: "negative" },  // apprehension / worry (Ekman fear family)
    { name: "Ashamed",      category: "negative" },  // self-focused moral pain (DBT/schema)
    { name: "Disappointed", category: "negative" },  // unmet expectation
    { name: "Disgusted",    category: "negative" },  // Ekman core; moral disgust too
    { name: "Embarrassed",  category: "negative" },  // social/exposure pain (distinct from shame)
    { name: "Fearful",      category: "negative" },  // acute threat response (Ekman core)
    { name: "Frustrated",   category: "negative" },  // blocked-goal anger variant
    { name: "Grieving",     category: "negative" },  // loss-specific sadness (distinct from Sad)
    { name: "Guilty",       category: "negative" },  // behaviour-focused moral pain (PANAS-X)
    { name: "Hopeless",     category: "negative" },  // core depression marker (clinically critical)
    { name: "Hurt",         category: "negative" },  // relational emotional pain (PANAS-X)
    { name: "Insecure",     category: "negative" },  // self-doubt / vulnerability
    { name: "Irritable",    category: "negative" },  // low-grade anger / agitation (clinical)
    { name: "Jealous",      category: "negative" },  // threat to relationship / status
    { name: "Lonely",       category: "negative" },  // social disconnection
    { name: "Numb",         category: "negative" },  // emotional blunting / dissociation
    { name: "Overwhelmed",  category: "negative" },  // cognitive/emotional overload
    { name: "Sad",          category: "negative" },  // Ekman core
    { name: "Stressed",     category: "negative" },  // perceived demand > resources

    // ── Neutral (5) ───────────────────────────────────────────────────────────
    { name: "Bored",        category: "neutral" },   // low stimulation / disengagement
    { name: "Confused",     category: "neutral" },   // cognitive uncertainty
    { name: "Curious",      category: "neutral" },   // exploratory interest (Cowen & Keltner)
    { name: "Surprised",    category: "neutral" },   // Ekman core; valence depends on context
    { name: "Tired",        category: "neutral" },   // fatigue / exhaustion (PANAS-X)
];

export const DEFAULT_CONTEXTS = [
    "Home",
    "Work",
    "Uni",
    "Outside",
    "Social",
    "Online",
    "Commuting",
];

export type QuickEntryPrefs = {
    showEmotions: boolean;
    showContext: boolean;
    showEnergy: boolean;
    showNotes: boolean;
};

export type HistoryCardStyle = "minimal" | "compact";

export type TherapyExportField =
    | "timestamp"
    | "mood"
    | "emotions"
    | "context"
    | "energy"
    | "notes";

export type TherapyExportPrefs = {
    fields: TherapyExportField[];
};

export const DEFAULT_QUICK_ENTRY_PREFS: QuickEntryPrefs = {
    showEmotions: true,
    showContext: true,
    showEnergy: true,
    showNotes: false,
};

export const DEFAULT_HISTORY_CARD_STYLE: HistoryCardStyle = "minimal";

export const DEFAULT_THERAPY_EXPORT_PREFS: TherapyExportPrefs = {
    fields: ["timestamp", "mood", "emotions", "context", "energy", "notes"],
};

// ── Pure parsing functions ────────────────────────────────────────────────────
// These are called by settingsStore after reading raw JSON from AsyncStorage.

function resolveEmotionCategory(name: string): Emotion["category"] {
    const matched = DEFAULT_EMOTIONS.find(
        (e) => e.name.toLowerCase() === name.toLowerCase()
    );
    return matched ? matched.category : "neutral";
}

/**
 * Parse raw AsyncStorage JSON into a validated Emotion[].
 * Accepts both old string-array format and current object format.
 * Returns DEFAULT_EMOTIONS on empty or invalid input.
 */
export function parseEmotionList(data: unknown): Emotion[] {
    if (!Array.isArray(data) || data.length === 0) {
        return DEFAULT_EMOTIONS;
    }

    const emotions = data
        .map((item): Emotion | null => {
            if (typeof item === "string" && item.trim().length > 0) {
                const name = item.trim();
                return { name, category: resolveEmotionCategory(name) };
            }
            if (
                typeof item === "object" &&
                item !== null &&
                typeof (item as Record<string, unknown>).name === "string" &&
                ((item as Record<string, unknown>).name as string).trim().length > 0
            ) {
                const name = ((item as Record<string, unknown>).name as string).trim();
                const category = (item as Record<string, unknown>).category;
                const validCategory =
                    category === "positive" || category === "negative" || category === "neutral"
                        ? category
                        : resolveEmotionCategory(name);
                return { name, category: validCategory };
            }
            return null;
        })
        .filter((item): item is Emotion => item !== null);

    return emotions.length > 0 ? emotions : DEFAULT_EMOTIONS;
}

/**
 * Parse raw AsyncStorage JSON into a validated string[].
 * Returns fallback on empty or invalid input.
 */
export function parseStringList(data: unknown, fallback: string[]): string[] {
    if (!Array.isArray(data) || data.length === 0) {
        return fallback;
    }
    const filtered = data.filter(
        (item) => typeof item === "string" && item.trim().length > 0
    );
    return filtered.length > 0 ? (filtered as string[]) : fallback;
}

/**
 * Validate and filter a therapy export field list.
 * Returns DEFAULT_THERAPY_EXPORT_PREFS.fields on empty or invalid input.
 */
export function sanitizeTherapyFields(value: unknown): TherapyExportField[] {
    if (!Array.isArray(value)) {
        return DEFAULT_THERAPY_EXPORT_PREFS.fields;
    }
    const allowed = new Set(DEFAULT_THERAPY_EXPORT_PREFS.fields);
    const cleaned = value.filter(
        (field): field is TherapyExportField =>
            typeof field === "string" && allowed.has(field as TherapyExportField)
    );
    return cleaned.length ? cleaned : DEFAULT_THERAPY_EXPORT_PREFS.fields;
}

export function sanitizeHistoryCardStyle(value: unknown): HistoryCardStyle {
    return value === "compact" ? "compact" : DEFAULT_HISTORY_CARD_STYLE;
}
