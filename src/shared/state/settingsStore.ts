import { create } from "zustand";
import type { QuickEntryPrefs } from "@/lib/entrySettings";
import type { Emotion } from "@db/types";
import type { MoodScaleConfig } from "@/types/moodScaleConfig";
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
import {
  DEV_OPTIONS_KEY,
  SHOW_LABELS_KEY,
  MOOD_SCALE_CONFIG_KEY,
  APP_LOCK_ENABLED_KEY,
  HAS_COMPLETED_ONBOARDING_KEY,
} from "@/shared/storage/keys";
import { getBoolean, setBoolean, getJson, setJson } from "@/shared/storage/asyncStorage";
import { HAPTICS_ENABLED_KEY } from "@/services/settingsService";
import { setHapticsEnabled as setHapticsEnabledGlobal } from "@/lib/haptics";
import { getDefaultMoodScaleConfig } from "@/lib/moodScaleUtils";

export type SettingsStore = {
  hydrated: boolean;

  showDetailedLabels: boolean;
  devOptionsEnabled: boolean;
  hapticsEnabled: boolean;

  emotions: Emotion[];
  contexts: string[];
  quickEntryPrefs: QuickEntryPrefs;

  // Mood scale configuration
  moodScaleConfig: MoodScaleConfig | null;

  // App lock
  appLockEnabled: boolean;

  // Onboarding
  hasCompletedOnboarding: boolean;

  hydrate: () => Promise<void>;
  setShowDetailedLabels: (value: boolean) => Promise<void>;
  setDevOptionsEnabled: (value: boolean) => Promise<void>;
  setHapticsEnabled: (value: boolean) => Promise<void>;

  setEmotions: (values: Emotion[]) => Promise<void>;
  setContexts: (values: string[]) => Promise<void>;
  setQuickEntryPrefs: (prefs: QuickEntryPrefs) => Promise<void>;

  // Mood scale
  setMoodScaleConfig: (config: MoodScaleConfig) => Promise<void>;

  // App lock
  setAppLockEnabled: (value: boolean) => Promise<void>;

  // Onboarding
  setHasCompletedOnboarding: (value: boolean) => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  hydrated: false,

  showDetailedLabels: false,
  devOptionsEnabled: false,
  hapticsEnabled: true,

  emotions: DEFAULT_EMOTIONS,
  contexts: DEFAULT_CONTEXTS,
  quickEntryPrefs: DEFAULT_QUICK_ENTRY_PREFS,

  moodScaleConfig: null,
  appLockEnabled: false,
  hasCompletedOnboarding: false,

  hydrate: async () => {
    const [
      showDetailedLabels,
      devOptionsEnabled,
      hapticsEnabled,
      emotions,
      contexts,
      prefs,
      moodScaleConfig,
      appLockEnabled,
      hasCompletedOnboarding,
    ] = await Promise.all([
      getBoolean(SHOW_LABELS_KEY),
      getBoolean(DEV_OPTIONS_KEY),
      getBoolean(HAPTICS_ENABLED_KEY),
      getEmotionPresets(),
      getContextTags(),
      getQuickEntryPrefs(),
      getJson<MoodScaleConfig>(MOOD_SCALE_CONFIG_KEY),
      getBoolean(APP_LOCK_ENABLED_KEY),
      getBoolean(HAS_COMPLETED_ONBOARDING_KEY),
    ]);

    const hapticsValue = hapticsEnabled ?? true;
    setHapticsEnabledGlobal(hapticsValue);

    set({
      hydrated: true,
      showDetailedLabels: showDetailedLabels ?? false,
      devOptionsEnabled: devOptionsEnabled ?? false,
      hapticsEnabled: hapticsValue,
      emotions,
      contexts,
      quickEntryPrefs: prefs,
      moodScaleConfig: moodScaleConfig ?? getDefaultMoodScaleConfig(),
      appLockEnabled: appLockEnabled ?? false,
      hasCompletedOnboarding: hasCompletedOnboarding ?? false,
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

  setHapticsEnabled: async (value) => {
    await setBoolean(HAPTICS_ENABLED_KEY, value);
    setHapticsEnabledGlobal(value);
    set({ hapticsEnabled: value });
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

  setMoodScaleConfig: async (config) => {
    await setJson(MOOD_SCALE_CONFIG_KEY, config);
    set({ moodScaleConfig: config });
  },

  setAppLockEnabled: async (value) => {
    await setBoolean(APP_LOCK_ENABLED_KEY, value);
    set({ appLockEnabled: value });
  },

  setHasCompletedOnboarding: async (value) => {
    await setBoolean(HAS_COMPLETED_ONBOARDING_KEY, value);
    set({ hasCompletedOnboarding: value });
  },
}));
