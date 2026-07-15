import type { Emotion } from "@db/types";
import { getContextTagsFromMoods, getEmotionsFromMoods } from "@db/db";
import {
  DEFAULT_CONTEXTS,
  DEFAULT_EMOTIONS,
} from "@/lib/entrySettings";
import { useSettingsStore } from "@/shared/state/settingsStore";

export type HistoryPresetScope = "all" | "emotions" | "contexts";

export type HistoryPresetDiff = {
  emotions: Emotion[];
  contexts: string[];
};

export type HistoryPresetSyncResult = {
  addedEmotions: Emotion[];
  addedContexts: string[];
};

export type HistoryPresetDiffInput = {
  currentEmotions: Emotion[];
  currentContexts: string[];
  historyEmotions: Emotion[];
  historyContexts: string[];
};

function normalizePresetKey(value: string): string {
  return value.trim().toLowerCase();
}

function includesEmotions(scope: HistoryPresetScope): boolean {
  return scope === "all" || scope === "emotions";
}

function includesContexts(scope: HistoryPresetScope): boolean {
  return scope === "all" || scope === "contexts";
}

function resolveEmotionCategory(category: Emotion["category"]): Emotion["category"] {
  return category === "positive" || category === "negative" || category === "neutral"
    ? category
    : "neutral";
}

function canonicalizeHistoryEmotion(emotion: Emotion): Emotion | null {
  const name = emotion.name.trim();
  if (!name) {
    return null;
  }

  const defaultEmotion = DEFAULT_EMOTIONS.find(
    (candidate) => normalizePresetKey(candidate.name) === normalizePresetKey(name)
  );

  if (defaultEmotion) {
    return defaultEmotion;
  }

  return {
    name,
    category: resolveEmotionCategory(emotion.category),
  };
}

function canonicalizeHistoryContext(context: string): string | null {
  const trimmed = context.trim();
  if (!trimmed) {
    return null;
  }

  return (
    DEFAULT_CONTEXTS.find(
      (candidate) => normalizePresetKey(candidate) === normalizePresetKey(trimmed)
    ) ?? trimmed
  );
}

export function buildHistoryPresetDiff({
  currentEmotions,
  currentContexts,
  historyEmotions,
  historyContexts,
}: HistoryPresetDiffInput): HistoryPresetDiff {
  const existingEmotionKeys = new Set(
    currentEmotions.map((emotion) => normalizePresetKey(emotion.name))
  );
  const existingContextKeys = new Set(
    currentContexts.map((context) => normalizePresetKey(context))
  );
  const queuedEmotionKeys = new Set<string>();
  const queuedContextKeys = new Set<string>();

  const emotions: Emotion[] = [];
  const contexts: string[] = [];

  for (const historyEmotion of historyEmotions) {
    const emotion = canonicalizeHistoryEmotion(historyEmotion);
    if (!emotion) {
      continue;
    }

    const key = normalizePresetKey(emotion.name);
    if (existingEmotionKeys.has(key) || queuedEmotionKeys.has(key)) {
      continue;
    }

    queuedEmotionKeys.add(key);
    emotions.push(emotion);
  }

  for (const historyContext of historyContexts) {
    const context = canonicalizeHistoryContext(historyContext);
    if (!context) {
      continue;
    }

    const key = normalizePresetKey(context);
    if (existingContextKeys.has(key) || queuedContextKeys.has(key)) {
      continue;
    }

    queuedContextKeys.add(key);
    contexts.push(context);
  }

  return { emotions, contexts };
}

async function ensureSettingsHydrated() {
  const state = useSettingsStore.getState();
  if (!state.hydrated) {
    await state.hydrate();
  }
  return useSettingsStore.getState();
}

export const presetSyncService = {
  async previewMissingFromHistory(
    scope: HistoryPresetScope = "all"
  ): Promise<HistoryPresetDiff> {
    const state = await ensureSettingsHydrated();
    const [historyEmotions, historyContexts] = await Promise.all([
      includesEmotions(scope) ? getEmotionsFromMoods() : Promise.resolve([]),
      includesContexts(scope) ? getContextTagsFromMoods() : Promise.resolve([]),
    ]);

    return buildHistoryPresetDiff({
      currentEmotions: state.emotions,
      currentContexts: state.contexts,
      historyEmotions,
      historyContexts,
    });
  },

  async addMissingFromHistory(
    scope: HistoryPresetScope = "all"
  ): Promise<HistoryPresetSyncResult> {
    const diff = await this.previewMissingFromHistory(scope);
    const state = await ensureSettingsHydrated();
    const additions = buildHistoryPresetDiff({
      currentEmotions: state.emotions,
      currentContexts: state.contexts,
      historyEmotions: diff.emotions,
      historyContexts: diff.contexts,
    });

    if (includesEmotions(scope) && additions.emotions.length > 0) {
      await state.setEmotions([...state.emotions, ...additions.emotions]);
    }

    if (includesContexts(scope) && additions.contexts.length > 0) {
      await useSettingsStore
        .getState()
        .setContexts([...useSettingsStore.getState().contexts, ...additions.contexts]);
    }

    return {
      addedEmotions: additions.emotions,
      addedContexts: additions.contexts,
    };
  },
};

export default presetSyncService;
