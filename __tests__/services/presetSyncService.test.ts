import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Emotion } from "../../db/types";
import {
  DEFAULT_HISTORY_CARD_STYLE,
  DEFAULT_QUICK_ENTRY_PREFS,
} from "../../src/lib/entrySettings";

const mocks = vi.hoisted(() => ({
  getContextTagsFromMoods: vi.fn(),
  getEmotionsFromMoods: vi.fn(),
  setHapticsEnabled: vi.fn(),
}));

vi.mock("@db/db", () => ({
  getContextTagsFromMoods: mocks.getContextTagsFromMoods,
  getEmotionsFromMoods: mocks.getEmotionsFromMoods,
}));

vi.mock("@/lib/haptics", () => ({
  setHapticsEnabled: mocks.setHapticsEnabled,
}));

import {
  buildHistoryPresetDiff,
  presetSyncService,
} from "../../src/services/presetSyncService";
import { useSettingsStore } from "../../src/shared/state/settingsStore";

function resetSettingsStore(overrides?: {
  emotions?: Emotion[];
  contexts?: string[];
  hydrated?: boolean;
}) {
  useSettingsStore.setState({
    hydrated: overrides?.hydrated ?? true,
    showDetailedLabels: false,
    devOptionsEnabled: false,
    hapticsEnabled: true,
    historyCardStyle: DEFAULT_HISTORY_CARD_STYLE,
    emotions: overrides?.emotions ?? [],
    contexts: overrides?.contexts ?? [],
    quickEntryPrefs: DEFAULT_QUICK_ENTRY_PREFS,
  });
}

describe("presetSyncService", () => {
  beforeEach(() => {
    resetSettingsStore();
    mocks.getContextTagsFromMoods.mockReset();
    mocks.getEmotionsFromMoods.mockReset();
    mocks.setHapticsEnabled.mockReset();
  });

  it("builds a diff without duplicating existing or repeated history presets", () => {
    const diff = buildHistoryPresetDiff({
      currentEmotions: [{ name: "happy", category: "negative" }],
      currentContexts: ["work"],
      historyEmotions: [
        { name: " Happy ", category: "positive" },
        { name: "Calm", category: "positive" },
        { name: "calm", category: "negative" },
      ],
      historyContexts: [" Work ", " uni ", "Doctor", "doctor"],
    });

    expect(diff).toEqual({
      emotions: [{ name: "Calm", category: "positive" }],
      contexts: ["Uni", "Doctor"],
    });
  });

  it("canonicalizes missing built-in presets from history", () => {
    const diff = buildHistoryPresetDiff({
      currentEmotions: [],
      currentContexts: [],
      historyEmotions: [{ name: "happy", category: "negative" }],
      historyContexts: [" uni "],
    });

    expect(diff).toEqual({
      emotions: [{ name: "Happy", category: "positive" }],
      contexts: ["Uni"],
    });
  });

  it("adds missing history presets to settings without rewriting existing values", async () => {
    resetSettingsStore({
      emotions: [{ name: "Happy", category: "negative" }],
      contexts: ["Home"],
    });
    mocks.getEmotionsFromMoods.mockResolvedValue([
      { name: "Happy", category: "positive" },
      { name: "Calm", category: "positive" },
    ]);
    mocks.getContextTagsFromMoods.mockResolvedValue(["home", "Work"]);

    const result = await presetSyncService.addMissingFromHistory("all");

    expect(result).toEqual({
      addedEmotions: [{ name: "Calm", category: "positive" }],
      addedContexts: ["Work"],
    });
    expect(useSettingsStore.getState().emotions).toEqual([
      { name: "Happy", category: "negative" },
      { name: "Calm", category: "positive" },
    ]);
    expect(useSettingsStore.getState().contexts).toEqual(["Home", "Work"]);
  });

  it("honors scope-specific history sync", async () => {
    mocks.getEmotionsFromMoods.mockResolvedValue([
      { name: "Calm", category: "neutral" },
    ]);
    mocks.getContextTagsFromMoods.mockResolvedValue(["Work"]);

    await expect(presetSyncService.previewMissingFromHistory("contexts")).resolves.toEqual({
      emotions: [],
      contexts: ["Work"],
    });
    expect(mocks.getEmotionsFromMoods).not.toHaveBeenCalled();
  });
});
