/**
 * Settings Service
 * Abstracts AsyncStorage operations for app settings.
 * Provides a clean API for settings management.
 */

import type { Emotion } from "@db/types";
import {
  getBoolean,
  setBoolean,
  getJson,
  setJson,
} from "@/shared/storage/asyncStorage";
import {
  EMOTION_PRESETS_KEY,
  CONTEXT_TAGS_KEY,
  QUICK_ENTRY_PREFS_KEY,
  THERAPY_EXPORT_PREFS_KEY,
  DEFAULT_EMOTIONS,
  DEFAULT_CONTEXTS,
  DEFAULT_QUICK_ENTRY_PREFS,
  DEFAULT_THERAPY_EXPORT_PREFS,
  type QuickEntryPrefs,
  type TherapyExportPrefs,
  type TherapyExportField,
} from "@/lib/entrySettings";
import { SHOW_LABELS_KEY, DEV_OPTIONS_KEY } from "@/shared/storage/keys";

export const HAPTICS_ENABLED_KEY = "hapticsEnabled";

export interface SettingsServiceInterface {
  // Display settings
  getShowDetailedLabels: () => Promise<boolean>;
  setShowDetailedLabels: (value: boolean) => Promise<void>;
  getDevOptionsEnabled: () => Promise<boolean>;
  setDevOptionsEnabled: (value: boolean) => Promise<void>;
  getHapticsEnabled: () => Promise<boolean>;
  setHapticsEnabled: (value: boolean) => Promise<void>;

  // Entry presets
  getEmotionPresets: () => Promise<Emotion[]>;
  setEmotionPresets: (emotions: Emotion[]) => Promise<void>;
  getContextTags: () => Promise<string[]>;
  setContextTags: (tags: string[]) => Promise<void>;

  // Quick entry preferences
  getQuickEntryPrefs: () => Promise<QuickEntryPrefs>;
  setQuickEntryPrefs: (prefs: QuickEntryPrefs) => Promise<void>;

  // Therapy export preferences
  getTherapyExportPrefs: () => Promise<TherapyExportPrefs>;
  setTherapyExportPrefs: (prefs: TherapyExportPrefs) => Promise<void>;

  // Bulk operations
  getAllSettings: () => Promise<AllSettings>;
}

export interface AllSettings {
  showDetailedLabels: boolean;
  devOptionsEnabled: boolean;
  hapticsEnabled: boolean;
  emotionPresets: Emotion[];
  contextTags: string[];
  quickEntryPrefs: QuickEntryPrefs;
  therapyExportPrefs: TherapyExportPrefs;
}

function resolveEmotionCategory(name: string): Emotion["category"] {
  const matched = DEFAULT_EMOTIONS.find(
    (emotion) => emotion.name.toLowerCase() === name.toLowerCase()
  );
  return matched ? matched.category : "neutral";
}

function parseEmotionList(data: unknown): Emotion[] {
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
          category === "positive" ||
          category === "negative" ||
          category === "neutral"
            ? category
            : resolveEmotionCategory(name);
        return { name, category: validCategory };
      }
      return null;
    })
    .filter((item): item is Emotion => item !== null);

  return emotions.length > 0 ? emotions : DEFAULT_EMOTIONS;
}

function parseStringList(data: unknown, fallback: string[]): string[] {
  if (!Array.isArray(data) || data.length === 0) {
    return fallback;
  }
  const filtered = data.filter(
    (item) => typeof item === "string" && item.trim().length > 0
  );
  return filtered.length > 0 ? (filtered as string[]) : fallback;
}

function sanitizeTherapyFields(value: unknown): TherapyExportField[] {
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

export const settingsService: SettingsServiceInterface = {
  async getShowDetailedLabels(): Promise<boolean> {
    const value = await getBoolean(SHOW_LABELS_KEY);
    return value ?? false;
  },

  async setShowDetailedLabels(value: boolean): Promise<void> {
    await setBoolean(SHOW_LABELS_KEY, value);
  },

  async getDevOptionsEnabled(): Promise<boolean> {
    const value = await getBoolean(DEV_OPTIONS_KEY);
    return value ?? false;
  },

  async setDevOptionsEnabled(value: boolean): Promise<void> {
    await setBoolean(DEV_OPTIONS_KEY, value);
  },

  async getHapticsEnabled(): Promise<boolean> {
    const value = await getBoolean(HAPTICS_ENABLED_KEY);
    return value ?? true; // Default to enabled
  },

  async setHapticsEnabled(value: boolean): Promise<void> {
    await setBoolean(HAPTICS_ENABLED_KEY, value);
  },

  async getEmotionPresets(): Promise<Emotion[]> {
    const data = await getJson<unknown>(EMOTION_PRESETS_KEY);
    return parseEmotionList(data);
  },

  async setEmotionPresets(emotions: Emotion[]): Promise<void> {
    await setJson(EMOTION_PRESETS_KEY, emotions);
  },

  async getContextTags(): Promise<string[]> {
    const data = await getJson<unknown>(CONTEXT_TAGS_KEY);
    return parseStringList(data, DEFAULT_CONTEXTS);
  },

  async setContextTags(tags: string[]): Promise<void> {
    await setJson(CONTEXT_TAGS_KEY, tags);
  },

  async getQuickEntryPrefs(): Promise<QuickEntryPrefs> {
    const data = await getJson<Partial<QuickEntryPrefs>>(QUICK_ENTRY_PREFS_KEY);
    if (!data) {
      return DEFAULT_QUICK_ENTRY_PREFS;
    }
    return {
      ...DEFAULT_QUICK_ENTRY_PREFS,
      ...data,
    };
  },

  async setQuickEntryPrefs(prefs: QuickEntryPrefs): Promise<void> {
    await setJson(QUICK_ENTRY_PREFS_KEY, prefs);
  },

  async getTherapyExportPrefs(): Promise<TherapyExportPrefs> {
    const data = await getJson<{ fields?: unknown }>(THERAPY_EXPORT_PREFS_KEY);
    if (!data) {
      return DEFAULT_THERAPY_EXPORT_PREFS;
    }
    return {
      fields: sanitizeTherapyFields(data.fields),
    };
  },

  async setTherapyExportPrefs(prefs: TherapyExportPrefs): Promise<void> {
    await setJson(THERAPY_EXPORT_PREFS_KEY, prefs);
  },

  async getAllSettings(): Promise<AllSettings> {
    const [
      showDetailedLabels,
      devOptionsEnabled,
      hapticsEnabled,
      emotionPresets,
      contextTags,
      quickEntryPrefs,
      therapyExportPrefs,
    ] = await Promise.all([
      settingsService.getShowDetailedLabels(),
      settingsService.getDevOptionsEnabled(),
      settingsService.getHapticsEnabled(),
      settingsService.getEmotionPresets(),
      settingsService.getContextTags(),
      settingsService.getQuickEntryPrefs(),
      settingsService.getTherapyExportPrefs(),
    ]);

    return {
      showDetailedLabels,
      devOptionsEnabled,
      hapticsEnabled,
      emotionPresets,
      contextTags,
      quickEntryPrefs,
      therapyExportPrefs,
    };
  },
};

export default settingsService;
