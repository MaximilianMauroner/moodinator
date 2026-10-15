import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  DEFAULT_CONTEXTS,
  DEFAULT_EMOTIONS,
  DEFAULT_HISTORY_CARD_STYLE,
  DEFAULT_QUICK_ENTRY_PREFS,
} from "../../../src/lib/entrySettings";
import {
  CONTEXT_TAGS_KEY,
  DEV_OPTIONS_KEY,
  EMOTION_PRESETS_KEY,
  HAPTICS_ENABLED_KEY,
  HISTORY_CARD_STYLE_KEY,
  QUICK_ENTRY_PREFS_KEY,
  SHOW_LABELS_KEY,
} from "../../../src/shared/storage/keys";
import { createMockDb } from "../../db/mockClient";

const { setHapticsEnabledGlobal } = vi.hoisted(() => ({
  setHapticsEnabledGlobal: vi.fn(),
}));

vi.mock("@/lib/haptics", () => ({
  setHapticsEnabled: setHapticsEnabledGlobal,
}));

const moodDb = createMockDb();
const dbEntryPoints = vi.hoisted(() => ({
  readDb: vi.fn(),
  openDatabase: vi.fn(),
}));

vi.mock("@db/client", () => dbEntryPoints);

// A settings list edit is future-only. Rewriting stored mood snapshots, or
// even reaching the database, would change what history already recorded.
async function expectMoodSnapshotsUntouched(edit: () => Promise<void>) {
  moodDb.__reset();
  moodDb.__addMood({
    emotions: JSON.stringify(DEFAULT_EMOTIONS.slice(0, 2)),
    context_tags: JSON.stringify(DEFAULT_CONTEXTS.slice(0, 2)),
  });
  const seeded = moodDb.__getMoods();
  dbEntryPoints.readDb.mockReset().mockResolvedValue(moodDb);
  dbEntryPoints.openDatabase.mockReset().mockResolvedValue(moodDb);

  await edit();

  expect(dbEntryPoints.readDb).not.toHaveBeenCalled();
  expect(dbEntryPoints.openDatabase).not.toHaveBeenCalled();
  expect(moodDb.__getMoods()).toEqual(seeded);
}

import { useSettingsStore } from "../../../src/shared/state/settingsStore";

const resetStore = () => {
  useSettingsStore.setState({
    hydrated: false,
    showDetailedLabels: false,
    devOptionsEnabled: false,
    hapticsEnabled: true,
    historyCardStyle: DEFAULT_HISTORY_CARD_STYLE,
    emotions: DEFAULT_EMOTIONS,
    contexts: DEFAULT_CONTEXTS,
    quickEntryPrefs: DEFAULT_QUICK_ENTRY_PREFS,
  });
};

describe("useSettingsStore", () => {
  beforeEach(async () => {
    resetStore();
    setHapticsEnabledGlobal.mockReset();
    await AsyncStorage.clear();
  });

  test("hydrates from storage, merging defaults and parsing legacy values", async () => {
    await AsyncStorage.setItem(SHOW_LABELS_KEY, "true");
    await AsyncStorage.setItem(DEV_OPTIONS_KEY, "true");
    await AsyncStorage.setItem(HAPTICS_ENABLED_KEY, "false");
    await AsyncStorage.setItem(HISTORY_CARD_STYLE_KEY, "compact");
    await AsyncStorage.setItem(
      EMOTION_PRESETS_KEY,
      JSON.stringify(["Happy", "Unknown"])
    );
    await AsyncStorage.setItem(
      CONTEXT_TAGS_KEY,
      JSON.stringify(["Work", "", "Home"])
    );
    await AsyncStorage.setItem(
      QUICK_ENTRY_PREFS_KEY,
      JSON.stringify({ showNotes: true })
    );

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState()).toMatchObject({
      hydrated: true,
      showDetailedLabels: true,
      devOptionsEnabled: true,
      hapticsEnabled: false,
      historyCardStyle: "compact",
      emotions: [
        { name: "Happy", category: "positive" },
        { name: "Unknown", category: "neutral" },
      ],
      contexts: ["Work", "Home"],
      quickEntryPrefs: {
        ...DEFAULT_QUICK_ENTRY_PREFS,
        showNotes: true,
      },
    });
    expect(setHapticsEnabledGlobal).toHaveBeenCalledWith(false);
  });

  test("hydrates to defaults when storage is missing or invalid", async () => {
    await AsyncStorage.setItem(EMOTION_PRESETS_KEY, "{");
    await AsyncStorage.setItem(CONTEXT_TAGS_KEY, JSON.stringify([null, ""]));

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState()).toMatchObject({
      hydrated: true,
      showDetailedLabels: false,
      devOptionsEnabled: false,
      hapticsEnabled: true,
      historyCardStyle: DEFAULT_HISTORY_CARD_STYLE,
      emotions: DEFAULT_EMOTIONS,
      contexts: DEFAULT_CONTEXTS,
      quickEntryPrefs: DEFAULT_QUICK_ENTRY_PREFS,
    });
    expect(setHapticsEnabledGlobal).toHaveBeenCalledWith(true);
  });

  test("preserves explicitly empty emotion and context lists", async () => {
    await AsyncStorage.setItem(EMOTION_PRESETS_KEY, JSON.stringify([]));
    await AsyncStorage.setItem(CONTEXT_TAGS_KEY, JSON.stringify([]));

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().emotions).toEqual([]);
    expect(useSettingsStore.getState().contexts).toEqual([]);
  });

  test("setters update state optimistically and persist values", async () => {
    const nextEmotions = [{ name: "Calm", category: "positive" as const }];
    const nextContexts = ["Home", "Outside"];
    const nextQuickEntryPrefs = {
      showEmotions: false,
      showContext: true,
      showEnergy: false,
      showNotes: true,
    };

    const showLabelsPromise =
      useSettingsStore.getState().setShowDetailedLabels(true);
    expect(useSettingsStore.getState().showDetailedLabels).toBe(true);
    await showLabelsPromise;
    expect(await AsyncStorage.getItem(SHOW_LABELS_KEY)).toBe("true");

    const devOptionsPromise =
      useSettingsStore.getState().setDevOptionsEnabled(true);
    expect(useSettingsStore.getState().devOptionsEnabled).toBe(true);
    await devOptionsPromise;
    expect(await AsyncStorage.getItem(DEV_OPTIONS_KEY)).toBe("true");

    const hapticsPromise = useSettingsStore.getState().setHapticsEnabled(false);
    expect(useSettingsStore.getState().hapticsEnabled).toBe(false);
    expect(setHapticsEnabledGlobal).toHaveBeenLastCalledWith(false);
    await hapticsPromise;
    expect(await AsyncStorage.getItem(HAPTICS_ENABLED_KEY)).toBe("false");

    const historyCardStylePromise =
      useSettingsStore.getState().setHistoryCardStyle("compact");
    expect(useSettingsStore.getState().historyCardStyle).toBe("compact");
    await historyCardStylePromise;
    expect(await AsyncStorage.getItem(HISTORY_CARD_STYLE_KEY)).toBe("compact");

    const emotionsPromise = useSettingsStore.getState().setEmotions(nextEmotions);
    expect(useSettingsStore.getState().emotions).toEqual(nextEmotions);
    await emotionsPromise;
    expect(await AsyncStorage.getItem(EMOTION_PRESETS_KEY)).toBe(
      JSON.stringify(nextEmotions)
    );

    const contextsPromise = useSettingsStore.getState().setContexts(nextContexts);
    expect(useSettingsStore.getState().contexts).toEqual(nextContexts);
    await contextsPromise;
    expect(await AsyncStorage.getItem(CONTEXT_TAGS_KEY)).toBe(
      JSON.stringify(nextContexts)
    );

    const prefsPromise =
      useSettingsStore.getState().setQuickEntryPrefs(nextQuickEntryPrefs);
    expect(useSettingsStore.getState().quickEntryPrefs).toEqual(
      nextQuickEntryPrefs
    );
    await prefsPromise;
    expect(await AsyncStorage.getItem(QUICK_ENTRY_PREFS_KEY)).toBe(
      JSON.stringify(nextQuickEntryPrefs)
    );
  });

  test("setter promises resolve only after persistence completes", async () => {
    let finishWrite!: () => void;
    const pendingWrite = new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    vi.mocked(AsyncStorage.setItem).mockImplementationOnce(() => pendingWrite);

    const promise = useSettingsStore.getState().setShowDetailedLabels(true);
    let resolved = false;
    void promise.then(() => {
      resolved = true;
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(useSettingsStore.getState().showDetailedLabels).toBe(true);
    expect(resolved).toBe(false);

    finishWrite();
    await promise;
    await Promise.resolve();

    expect(resolved).toBe(true);
  });

  test("removing an emotion from the list does not touch the moods table", async () => {
    await expectMoodSnapshotsUntouched(() =>
      useSettingsStore.getState().setEmotions([
        { name: "Calm", category: "positive" as const },
      ])
    );

    expect(useSettingsStore.getState().emotions).toEqual([
      { name: "Calm", category: "positive" },
    ]);
  });

  test("removing a context tag from the list does not touch the moods table", async () => {
    await expectMoodSnapshotsUntouched(() =>
      useSettingsStore.getState().setContexts(["Home"])
    );

    expect(useSettingsStore.getState().contexts).toEqual(["Home"]);
  });

  test("renaming a context tag in the preset list does not touch the moods table (future-only default)", async () => {
    await expectMoodSnapshotsUntouched(() =>
      useSettingsStore.getState().setContexts(["Workplace", "Home"])
    );

    expect(useSettingsStore.getState().contexts).toEqual(["Workplace", "Home"]);
  });

  test("renaming an emotion in the preset list does not touch the moods table (future-only default)", async () => {
    await expectMoodSnapshotsUntouched(() =>
      useSettingsStore.getState().setEmotions([
        { name: "Joyful", category: "positive" as const },
      ])
    );

    expect(useSettingsStore.getState().emotions).toEqual([
      { name: "Joyful", category: "positive" },
    ]);
  });
});
