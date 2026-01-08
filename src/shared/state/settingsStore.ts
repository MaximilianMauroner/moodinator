import { create } from "zustand";
import type { QuickEntryPrefs } from "@/lib/entrySettings";
import {
  DEFAULT_CONTEXTS,
  DEFAULT_EMOTIONS,
  DEFAULT_QUICK_ENTRY_PREFS,
  getContextTags,
  getEmotionPresets,
  getQuickEntryPrefs,
  saveContextTags,
  saveEmotionPresets,
  saveQuickEntryPrefs,
} from "@/lib/entrySettings";
import { DEV_OPTIONS_KEY, SHOW_LABELS_KEY } from "@/shared/storage/keys";
import { getBoolean, setBoolean } from "@/shared/storage/asyncStorage";

type SettingsStore = {
  hydrated: boolean;

  showDetailedLabels: boolean;
  devOptionsEnabled: boolean;

  emotions: string[];
  contexts: string[];
  quickEntryPrefs: QuickEntryPrefs;

  hydrate: () => Promise<void>;
  setShowDetailedLabels: (value: boolean) => Promise<void>;
  setDevOptionsEnabled: (value: boolean) => Promise<void>;

  setEmotions: (values: string[]) => Promise<void>;
  setContexts: (values: string[]) => Promise<void>;
  setQuickEntryPrefs: (prefs: QuickEntryPrefs) => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  hydrated: false,

  showDetailedLabels: false,
  devOptionsEnabled: false,

  emotions: DEFAULT_EMOTIONS,
  contexts: DEFAULT_CONTEXTS,
  quickEntryPrefs: DEFAULT_QUICK_ENTRY_PREFS,

  hydrate: async () => {
    const [showDetailedLabels, devOptionsEnabled, emotions, contexts, prefs] =
      await Promise.all([
        getBoolean(SHOW_LABELS_KEY),
        getBoolean(DEV_OPTIONS_KEY),
        getEmotionPresets(),
        getContextTags(),
        getQuickEntryPrefs(),
      ]);

    set({
      hydrated: true,
      showDetailedLabels: showDetailedLabels ?? false,
      devOptionsEnabled: devOptionsEnabled ?? false,
      emotions,
      contexts,
      quickEntryPrefs: prefs,
    });
  },

  setShowDetailedLabels: async (value) => {
    await setBoolean(SHOW_LABELS_KEY, value);
    set({ showDetailedLabels: value });
  },

  setDevOptionsEnabled: async (value) => {
    await setBoolean(DEV_OPTIONS_KEY, value);
    set({ devOptionsEnabled: value });
  },

  setEmotions: async (values) => {
    await saveEmotionPresets(values);
    set({ emotions: values });
  },

  setContexts: async (values) => {
    await saveContextTags(values);
    set({ contexts: values });
  },

  setQuickEntryPrefs: async (prefs) => {
    await saveQuickEntryPrefs(prefs);
    set({ quickEntryPrefs: prefs });
  },
}));

