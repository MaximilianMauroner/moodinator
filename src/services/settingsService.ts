import type { Emotion } from "@db/types";
import {
  DEFAULT_CONTEXTS,
  DEFAULT_EMOTIONS,
  DEFAULT_HISTORY_CARD_STYLE,
  DEFAULT_QUICK_ENTRY_PREFS,
  parseEmotionList,
  parseStringList,
  sanitizeHistoryCardStyle,
  type HistoryCardStyle,
  type QuickEntryPrefs,
} from "@/lib/entrySettings";
import {
  CONTEXT_TAGS_KEY,
  DEV_OPTIONS_KEY,
  EMOTION_PRESETS_KEY,
  HAPTICS_ENABLED_KEY,
  HISTORY_CARD_STYLE_KEY,
  QUICK_ENTRY_PREFS_KEY,
  SHOW_LABELS_KEY,
} from "@/shared/storage/keys";
import {
  getBoolean,
  getJson,
  getString,
  setBoolean,
  setJson,
  setString,
} from "@/shared/storage/asyncStorage";

export type SettingsSnapshot = {
  showDetailedLabels: boolean;
  devOptionsEnabled: boolean;
  hapticsEnabled: boolean;
  historyCardStyle: HistoryCardStyle;
  emotions: Emotion[];
  contexts: string[];
  quickEntryPrefs: QuickEntryPrefs;
};

export const DEFAULT_SETTINGS_SNAPSHOT: SettingsSnapshot = {
  showDetailedLabels: false,
  devOptionsEnabled: false,
  hapticsEnabled: true,
  historyCardStyle: DEFAULT_HISTORY_CARD_STYLE,
  emotions: DEFAULT_EMOTIONS,
  contexts: DEFAULT_CONTEXTS,
  quickEntryPrefs: DEFAULT_QUICK_ENTRY_PREFS,
};

function migrateQuickEntryPrefs(
  value: Partial<QuickEntryPrefs> | null
): QuickEntryPrefs {
  return value
    ? { ...DEFAULT_QUICK_ENTRY_PREFS, ...value }
    : DEFAULT_QUICK_ENTRY_PREFS;
}

export const settingsService = {
  async load(): Promise<SettingsSnapshot> {
    const [
      showDetailedLabels,
      devOptionsEnabled,
      hapticsEnabled,
      historyCardStyle,
      emotionsRaw,
      contextsRaw,
      quickEntryPrefsRaw,
    ] = await Promise.all([
      getBoolean(SHOW_LABELS_KEY),
      getBoolean(DEV_OPTIONS_KEY),
      getBoolean(HAPTICS_ENABLED_KEY),
      getString(HISTORY_CARD_STYLE_KEY),
      getJson<unknown>(EMOTION_PRESETS_KEY),
      getJson<unknown>(CONTEXT_TAGS_KEY),
      getJson<Partial<QuickEntryPrefs>>(QUICK_ENTRY_PREFS_KEY),
    ]);

    return {
      showDetailedLabels:
        showDetailedLabels ?? DEFAULT_SETTINGS_SNAPSHOT.showDetailedLabels,
      devOptionsEnabled:
        devOptionsEnabled ?? DEFAULT_SETTINGS_SNAPSHOT.devOptionsEnabled,
      hapticsEnabled: hapticsEnabled ?? DEFAULT_SETTINGS_SNAPSHOT.hapticsEnabled,
      historyCardStyle: sanitizeHistoryCardStyle(historyCardStyle),
      emotions: parseEmotionList(emotionsRaw),
      contexts: parseStringList(contextsRaw, DEFAULT_CONTEXTS),
      quickEntryPrefs: migrateQuickEntryPrefs(quickEntryPrefsRaw),
    };
  },

  setShowDetailedLabels(value: boolean): Promise<void> {
    return setBoolean(SHOW_LABELS_KEY, value);
  },

  setDevOptionsEnabled(value: boolean): Promise<void> {
    return setBoolean(DEV_OPTIONS_KEY, value);
  },

  setHapticsEnabled(value: boolean): Promise<void> {
    return setBoolean(HAPTICS_ENABLED_KEY, value);
  },

  setHistoryCardStyle(value: HistoryCardStyle): Promise<void> {
    return setString(HISTORY_CARD_STYLE_KEY, value);
  },

  setEmotions(values: Emotion[]): Promise<void> {
    return setJson(EMOTION_PRESETS_KEY, values);
  },

  setContexts(values: string[]): Promise<void> {
    return setJson(CONTEXT_TAGS_KEY, values);
  },

  setQuickEntryPrefs(prefs: QuickEntryPrefs): Promise<void> {
    return setJson(QUICK_ENTRY_PREFS_KEY, prefs);
  },
};
