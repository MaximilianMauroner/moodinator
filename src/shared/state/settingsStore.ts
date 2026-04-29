import { create } from "zustand";
import {
    DEFAULT_CONTEXTS,
    DEFAULT_EMOTIONS,
    DEFAULT_QUICK_ENTRY_PREFS,
    parseEmotionList,
    parseStringList,
    type QuickEntryPrefs,
} from "@/lib/entrySettings";
import type { Emotion } from "@db/types";
import {
    DEV_OPTIONS_KEY,
    EMOTION_PRESETS_KEY,
    CONTEXT_TAGS_KEY,
    QUICK_ENTRY_PREFS_KEY,
    HAPTICS_ENABLED_KEY,
    SHOW_LABELS_KEY,
} from "@/shared/storage/keys";
import {
    getBoolean,
    setBoolean,
    getJson,
    setJson,
} from "@/shared/storage/asyncStorage";
import { setHapticsEnabled as setHapticsEnabledGlobal } from "@/lib/haptics";

// Note: therapyExportPrefs are intentionally absent. They have only one
// subscriber (therapy-export.tsx) and do not need a global reactive store.
// Storage helpers live in src/lib/therapyExportPrefs.ts.
export type SettingsStore = {
    hydrated: boolean;

    showDetailedLabels: boolean;
    devOptionsEnabled: boolean;
    hapticsEnabled: boolean;

    emotions: Emotion[];
    contexts: string[];
    quickEntryPrefs: QuickEntryPrefs;

    hydrate: () => Promise<void>;
    setShowDetailedLabels: (value: boolean) => Promise<void>;
    setDevOptionsEnabled: (value: boolean) => Promise<void>;
    setHapticsEnabled: (value: boolean) => Promise<void>;

    setEmotions: (values: Emotion[]) => Promise<void>;
    setContexts: (values: string[]) => Promise<void>;
    setQuickEntryPrefs: (prefs: QuickEntryPrefs) => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set) => ({
    hydrated: false,

    showDetailedLabels: false,
    devOptionsEnabled: false,
    hapticsEnabled: true,

    emotions: DEFAULT_EMOTIONS,
    contexts: DEFAULT_CONTEXTS,
    quickEntryPrefs: DEFAULT_QUICK_ENTRY_PREFS,

    hydrate: async () => {
        const [
            showDetailedLabels,
            devOptionsEnabled,
            hapticsEnabled,
            emotionsRaw,
            contextsRaw,
            quickEntryPrefsRaw,
        ] = await Promise.all([
            getBoolean(SHOW_LABELS_KEY),
            getBoolean(DEV_OPTIONS_KEY),
            getBoolean(HAPTICS_ENABLED_KEY),
            getJson<unknown>(EMOTION_PRESETS_KEY),
            getJson<unknown>(CONTEXT_TAGS_KEY),
            getJson<Partial<QuickEntryPrefs>>(QUICK_ENTRY_PREFS_KEY),
        ]);

        const hapticsValue = hapticsEnabled ?? true;
        setHapticsEnabledGlobal(hapticsValue);

        set({
            hydrated: true,
            showDetailedLabels: showDetailedLabels ?? false,
            devOptionsEnabled: devOptionsEnabled ?? false,
            hapticsEnabled: hapticsValue,
            emotions: parseEmotionList(emotionsRaw),
            contexts: parseStringList(contextsRaw, DEFAULT_CONTEXTS),
            quickEntryPrefs: quickEntryPrefsRaw
                ? { ...DEFAULT_QUICK_ENTRY_PREFS, ...quickEntryPrefsRaw }
                : DEFAULT_QUICK_ENTRY_PREFS,
        });
    },

    // Optimistic writes: state updates immediately; storage write fires async.
    // AsyncStorage failures on device are effectively impossible, so no rollback
    // is implemented. A failed write would cause a silent divergence on the
    // next cold launch — an accepted risk.

    setShowDetailedLabels: async (value) => {
        set({ showDetailedLabels: value });
        void setBoolean(SHOW_LABELS_KEY, value);
    },

    setDevOptionsEnabled: async (value) => {
        set({ devOptionsEnabled: value });
        void setBoolean(DEV_OPTIONS_KEY, value);
    },

    setHapticsEnabled: async (value) => {
        setHapticsEnabledGlobal(value);
        set({ hapticsEnabled: value });
        void setBoolean(HAPTICS_ENABLED_KEY, value);
    },

    setEmotions: async (values) => {
        set({ emotions: values });
        void setJson(EMOTION_PRESETS_KEY, values);
    },

    setContexts: async (values) => {
        set({ contexts: values });
        void setJson(CONTEXT_TAGS_KEY, values);
    },

    setQuickEntryPrefs: async (prefs) => {
        set({ quickEntryPrefs: prefs });
        void setJson(QUICK_ENTRY_PREFS_KEY, prefs);
    },
}));
