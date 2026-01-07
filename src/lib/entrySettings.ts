import AsyncStorage from "@react-native-async-storage/async-storage";

export const EMOTION_PRESETS_KEY = "emotionPresets";
export const CONTEXT_TAGS_KEY = "contextTags";
export const QUICK_ENTRY_PREFS_KEY = "quickEntryPrefs";
export const THERAPY_EXPORT_PREFS_KEY = "therapyExportPrefs";
export const CUSTOM_MOOD_LABELS_KEY = "customMoodLabels";

export const DEFAULT_EMOTIONS = [
    "Happy",
    "Calm",
    "Excited",
    "Anxious",
    "Sad",
    "Stressed",
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

export async function getEmotionPresets(): Promise<string[]> {
    return loadList(EMOTION_PRESETS_KEY, DEFAULT_EMOTIONS);
}

export async function getContextTags(): Promise<string[]> {
    return loadList(CONTEXT_TAGS_KEY, DEFAULT_CONTEXTS);
}

export async function saveEmotionPresets(values: string[]) {
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

export type CustomMoodLabel = {
    value: number;
    label: string;
};

export const DEFAULT_MOOD_LABELS: CustomMoodLabel[] = [
    { value: 0, label: "Elated" },
    { value: 1, label: "Very Happy" },
    { value: 2, label: "Good" },
    { value: 3, label: "Positive" },
    { value: 4, label: "Okay" },
    { value: 5, label: "Neutral" },
    { value: 6, label: "Low" },
    { value: 7, label: "Struggling" },
    { value: 8, label: "Overwhelmed" },
    { value: 9, label: "Crisis" },
    { value: 10, label: "Emergency" },
];

export async function getCustomMoodLabels(): Promise<CustomMoodLabel[]> {
    try {
        const value = await AsyncStorage.getItem(CUSTOM_MOOD_LABELS_KEY);
        if (value) {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed) && parsed.length === 11) {
                // Validate that we have all 11 labels (0-10)
                const valid = parsed.every(
                    (item) =>
                        typeof item === "object" &&
                        typeof item.value === "number" &&
                        typeof item.label === "string" &&
                        item.value >= 0 &&
                        item.value <= 10
                );
                if (valid) {
                    return parsed;
                }
            }
        }
    } catch (error) {
        console.error("Failed to load custom mood labels:", error);
    }
    return DEFAULT_MOOD_LABELS;
}

export async function saveCustomMoodLabels(labels: CustomMoodLabel[]) {
    await AsyncStorage.setItem(CUSTOM_MOOD_LABELS_KEY, JSON.stringify(labels));
}

export async function resetMoodLabels() {
    await AsyncStorage.removeItem(CUSTOM_MOOD_LABELS_KEY);
}

