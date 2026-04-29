import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Emotion } from "../../db/types";

export const EMOTION_PRESETS_KEY = "emotionPresets";
export const CONTEXT_TAGS_KEY = "contextTags";
export const QUICK_ENTRY_PREFS_KEY = "quickEntryPrefs";
export const THERAPY_EXPORT_PREFS_KEY = "therapyExportPrefs";

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

export const DEFAULT_THERAPY_EXPORT_PREFS: TherapyExportPrefs = {
    fields: ["timestamp", "mood", "emotions", "context", "energy", "notes"],
};

async function loadList(key: string, fallback: string[]): Promise<string[]> {
    try {
        const value = await AsyncStorage.getItem(key);
        if (value) {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.filter((item) => typeof item === "string" && item.trim().length > 0);
            }
        }
    } catch (error) {
        console.error(`Failed to load list for ${key}:`, error);
    }
    return fallback;
}

async function loadEmotionList(key: string, fallback: Emotion[]): Promise<Emotion[]> {
    try {
        const value = await AsyncStorage.getItem(key);
        if (value) {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const resolveCategory = (name: string): Emotion["category"] => {
                    const matched = DEFAULT_EMOTIONS.find(
                        (emotion) => emotion.name.toLowerCase() === name.toLowerCase()
                    );
                    return matched ? matched.category : "neutral";
                };
                // Support both old format (strings) and new format (objects)
                const emotions = parsed.map((item): Emotion | null => {
                    if (typeof item === "string" && item.trim().length > 0) {
                        // Migrate old string format to object format
                        const name = item.trim();
                        return { name, category: resolveCategory(name) };
                    } else if (
                        typeof item === "object" &&
                        item !== null &&
                        typeof item.name === "string" &&
                        item.name.trim().length > 0
                    ) {
                        const name = item.name.trim();
                        const category =
                            item.category === "positive" ||
                            item.category === "negative" ||
                            item.category === "neutral"
                                ? item.category
                                : resolveCategory(name);
                        return { name, category };
                    }
                    return null;
                }).filter((item): item is Emotion => item !== null);

                if (emotions.length > 0) {
                    return emotions;
                }
            }
        }
    } catch (error) {
        console.error(`Failed to load emotion list for ${key}:`, error);
    }
    return fallback;
}

export async function getEmotionPresets(): Promise<Emotion[]> {
    return loadEmotionList(EMOTION_PRESETS_KEY, DEFAULT_EMOTIONS);
}

export async function getContextTags(): Promise<string[]> {
    return loadList(CONTEXT_TAGS_KEY, DEFAULT_CONTEXTS);
}

export async function saveEmotionPresets(values: Emotion[]) {
    await AsyncStorage.setItem(EMOTION_PRESETS_KEY, JSON.stringify(values));
}

export async function saveContextTags(values: string[]) {
    await AsyncStorage.setItem(CONTEXT_TAGS_KEY, JSON.stringify(values));
}

export async function getQuickEntryPrefs(): Promise<QuickEntryPrefs> {
    try {
        const value = await AsyncStorage.getItem(QUICK_ENTRY_PREFS_KEY);
        if (value) {
            const parsed = JSON.parse(value);
            return {
                ...DEFAULT_QUICK_ENTRY_PREFS,
                ...parsed,
            };
        }
    } catch (error) {
        console.error("Failed to load quick entry preferences:", error);
    }
    return DEFAULT_QUICK_ENTRY_PREFS;
}

export async function saveQuickEntryPrefs(prefs: QuickEntryPrefs) {
    await AsyncStorage.setItem(QUICK_ENTRY_PREFS_KEY, JSON.stringify(prefs));
}

function sanitizeTherapyFields(value: unknown): TherapyExportField[] {
    if (!Array.isArray(value)) {
        return DEFAULT_THERAPY_EXPORT_PREFS.fields;
    }
    const allowed = new Set(DEFAULT_THERAPY_EXPORT_PREFS.fields);
    const cleaned = value.filter((field): field is TherapyExportField => typeof field === "string" && allowed.has(field as TherapyExportField));
    return cleaned.length ? cleaned : DEFAULT_THERAPY_EXPORT_PREFS.fields;
}

export async function getTherapyExportPrefs(): Promise<TherapyExportPrefs> {
    try {
        const value = await AsyncStorage.getItem(THERAPY_EXPORT_PREFS_KEY);
        if (value) {
            const parsed = JSON.parse(value);
            return {
                fields: sanitizeTherapyFields(parsed?.fields),
            };
        }
    } catch (error) {
        console.error("Failed to load therapy export prefs:", error);
    }
    return DEFAULT_THERAPY_EXPORT_PREFS;
}

export async function saveTherapyExportPrefs(prefs: TherapyExportPrefs) {
    await AsyncStorage.setItem(THERAPY_EXPORT_PREFS_KEY, JSON.stringify(prefs));
}

export async function getEntrySettings() {
    const [emotionPresets, contextTags, quickEntryPrefs] = await Promise.all([
        getEmotionPresets(),
        getContextTags(),
        getQuickEntryPrefs(),
    ]);
    return { emotionPresets, contextTags, quickEntryPrefs };
}
