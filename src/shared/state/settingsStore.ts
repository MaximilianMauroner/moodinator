import { create } from "zustand";
import type { HistoryCardStyle, QuickEntryPrefs } from "@/lib/entrySettings";
import type { Emotion } from "@db/types";
import {
    DEFAULT_SETTINGS_SNAPSHOT,
    settingsService,
} from "@/services/settingsService";
import { setHapticsEnabled as setHapticsEnabledGlobal } from "@/lib/haptics";

// Note: therapyExportPrefs are intentionally absent. They have only one
// subscriber (therapy-export.tsx) and do not need a global reactive store.
// Storage helpers live in src/lib/therapyExportPrefs.ts.
export type SettingsStore = {
    hydrated: boolean;

    showDetailedLabels: boolean;
    devOptionsEnabled: boolean;
    hapticsEnabled: boolean;
    historyCardStyle: HistoryCardStyle;

    emotions: Emotion[];
    contexts: string[];
    quickEntryPrefs: QuickEntryPrefs;

    hydrate: () => Promise<void>;
    setShowDetailedLabels: (value: boolean) => Promise<void>;
    setDevOptionsEnabled: (value: boolean) => Promise<void>;
    setHapticsEnabled: (value: boolean) => Promise<void>;
    setHistoryCardStyle: (value: HistoryCardStyle) => Promise<void>;

    setEmotions: (values: Emotion[]) => Promise<void>;
    setContexts: (values: string[]) => Promise<void>;
    setQuickEntryPrefs: (prefs: QuickEntryPrefs) => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set) => ({
    hydrated: false,

    showDetailedLabels: DEFAULT_SETTINGS_SNAPSHOT.showDetailedLabels,
    devOptionsEnabled: DEFAULT_SETTINGS_SNAPSHOT.devOptionsEnabled,
    hapticsEnabled: DEFAULT_SETTINGS_SNAPSHOT.hapticsEnabled,
    historyCardStyle: DEFAULT_SETTINGS_SNAPSHOT.historyCardStyle,

    emotions: DEFAULT_SETTINGS_SNAPSHOT.emotions,
    contexts: DEFAULT_SETTINGS_SNAPSHOT.contexts,
    quickEntryPrefs: DEFAULT_SETTINGS_SNAPSHOT.quickEntryPrefs,

    hydrate: async () => {
        const snapshot = await settingsService.load();
        setHapticsEnabledGlobal(snapshot.hapticsEnabled);

        set({
            hydrated: true,
            ...snapshot,
        });
    },

    setShowDetailedLabels: async (value) => {
        set({ showDetailedLabels: value });
        await settingsService.setShowDetailedLabels(value);
    },

    setDevOptionsEnabled: async (value) => {
        set({ devOptionsEnabled: value });
        await settingsService.setDevOptionsEnabled(value);
    },

    setHapticsEnabled: async (value) => {
        setHapticsEnabledGlobal(value);
        set({ hapticsEnabled: value });
        await settingsService.setHapticsEnabled(value);
    },

    setHistoryCardStyle: async (value) => {
        set({ historyCardStyle: value });
        await settingsService.setHistoryCardStyle(value);
    },

    setEmotions: async (values) => {
        set({ emotions: values });
        await settingsService.setEmotions(values);
    },

    setContexts: async (values) => {
        set({ contexts: values });
        await settingsService.setContexts(values);
    },

    setQuickEntryPrefs: async (prefs) => {
        set({ quickEntryPrefs: prefs });
        await settingsService.setQuickEntryPrefs(prefs);
    },
}));
