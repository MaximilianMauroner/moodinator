import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Emotion } from "../../db/types";

export const EMOTION_PRESETS_KEY = "emotionPresets";
export const CONTEXT_TAGS_KEY = "contextTags";
export const QUICK_ENTRY_PREFS_KEY = "quickEntryPrefs";
export const THERAPY_EXPORT_PREFS_KEY = "therapyExportPrefs";

export const DEFAULT_EMOTIONS: Emotion[] = [
    { name: "Happy", category: "positive" },
    { name: "Calm", category: "positive" },
    { name: "Excited", category: "positive" },
    { name: "Anxious", category: "negative" },
    { name: "Sad", category: "negative" },
    { name: "Stressed", category: "negative" },
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
