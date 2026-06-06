import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_CONTEXTS,
  DEFAULT_EMOTIONS,
  DEFAULT_HISTORY_CARD_STYLE,
  DEFAULT_QUICK_ENTRY_PREFS,
} from "../../src/lib/entrySettings";
import { settingsService } from "../../src/services/settingsService";
import {
  CONTEXT_TAGS_KEY,
  EMOTION_PRESETS_KEY,
  HISTORY_CARD_STYLE_KEY,
  QUICK_ENTRY_PREFS_KEY,
} from "../../src/shared/storage/keys";

describe("settingsService", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("loads defaults when persisted settings are missing or corrupted", async () => {
    await AsyncStorage.setItem(EMOTION_PRESETS_KEY, "{");
    await AsyncStorage.setItem(CONTEXT_TAGS_KEY, JSON.stringify([null, ""]));
    await AsyncStorage.setItem(HISTORY_CARD_STYLE_KEY, "unknown");

    await expect(settingsService.load()).resolves.toMatchObject({
      historyCardStyle: DEFAULT_HISTORY_CARD_STYLE,
      emotions: DEFAULT_EMOTIONS,
      contexts: DEFAULT_CONTEXTS,
      quickEntryPrefs: DEFAULT_QUICK_ENTRY_PREFS,
    });
  });

  it("migrates partial quick-entry preferences onto current defaults", async () => {
    await AsyncStorage.setItem(
      QUICK_ENTRY_PREFS_KEY,
      JSON.stringify({ showNotes: true })
    );

    await expect(settingsService.load()).resolves.toMatchObject({
      quickEntryPrefs: {
        ...DEFAULT_QUICK_ENTRY_PREFS,
        showNotes: true,
      },
    });
  });
});
