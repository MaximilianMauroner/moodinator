import { useState, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import {
  DEFAULT_CONTEXTS,
  DEFAULT_EMOTIONS,
  DEFAULT_QUICK_ENTRY_PREFS,
  getContextTags,
  getEmotionPresets,
  getQuickEntryPrefs,
  QuickEntryPrefs,
} from "@/lib/entrySettings";
import type { Emotion } from "@db/types";

const SHOW_LABELS_KEY = "showLabelsPreference";

/**
 * Hook for managing entry settings and preferences.
 * Handles emotion options, context options, quick entry prefs, and label visibility.
 */
export function useEntrySettings() {
  const [showDetailedLabels, setShowDetailedLabels] = useState(false);
  const [emotionOptions, setEmotionOptions] = useState<Emotion[]>(DEFAULT_EMOTIONS);
  const [contextOptions, setContextOptions] = useState<string[]>(DEFAULT_CONTEXTS);
  const [quickEntryPrefs, setQuickEntryPrefs] = useState<QuickEntryPrefs>(
    DEFAULT_QUICK_ENTRY_PREFS
  );

  const loadShowLabelsPreference = useCallback(async () => {
    try {
      const value = await AsyncStorage.getItem(SHOW_LABELS_KEY);
      if (value !== null) {
        setShowDetailedLabels(value === "true");
      }
    } catch (error) {
      console.error("Failed to load label preference:", error);
    }
  }, []);

  const loadEntrySettings = useCallback(async () => {
    try {
      const [emotionList, contextList, prefs] = await Promise.all([
        getEmotionPresets(),
        getContextTags(),
        getQuickEntryPrefs(),
      ]);
      setEmotionOptions(emotionList);
      setContextOptions(contextList);
      setQuickEntryPrefs(prefs);
    } catch (error) {
      console.error("Failed to load entry settings:", error);
    }
  }, []);

  // Load preferences on mount
  useFocusEffect(
    useCallback(() => {
      loadShowLabelsPreference();
      loadEntrySettings();
    }, [loadShowLabelsPreference, loadEntrySettings])
  );

  const quickEntryFieldConfig = useMemo(
    () => ({
      emotions: quickEntryPrefs.showEmotions,
      context: quickEntryPrefs.showContext,
      energy: quickEntryPrefs.showEnergy,
      notes: quickEntryPrefs.showNotes,
    }),
    [quickEntryPrefs]
  );

  const detailedFieldConfig = useMemo(
    () => ({
      emotions: true,
      context: true,
      energy: true,
      notes: true,
    }),
    []
  );

  return {
    showDetailedLabels,
    emotionOptions,
    contextOptions,
    quickEntryPrefs,
    quickEntryFieldConfig,
    detailedFieldConfig,
    loadShowLabelsPreference,
    loadEntrySettings,
  };
}

export default useEntrySettings;
