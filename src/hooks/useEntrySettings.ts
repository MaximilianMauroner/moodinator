import { useCallback, useMemo } from "react";
import { useSettingsStore } from "@/shared/state/settingsStore";
import type { Emotion } from "@db/types";

// detailedFieldConfig never changes — all fields are always shown in
// detailed mode. Module-level constant avoids re-creating it each render.
const detailedFieldConfig = {
    emotions: true,
    context: true,
    energy: true,
    notes: true,
} as const;

export type EntryPresetCreateResult<T> = {
    value: T;
    created: boolean;
};

function normalizePresetKey(value: string): string {
    return value.trim().toLowerCase();
}

/**
 * Selector hook for entry form settings.
 *
 * Reads from useSettingsStore — no AsyncStorage reads, no focus effects.
 * The store is guaranteed hydrated before any screen mounts (see _layout.tsx).
 */
export function useEntrySettings() {
    const emotions = useSettingsStore((state) => state.emotions);
    const contexts = useSettingsStore((state) => state.contexts);
    const quickEntryPrefs = useSettingsStore((state) => state.quickEntryPrefs);
    const showDetailedLabels = useSettingsStore((state) => state.showDetailedLabels);

    const createEmotionOption = useCallback(
        async (
            name: string,
            category: Emotion["category"]
        ): Promise<EntryPresetCreateResult<Emotion> | null> => {
            const trimmed = name.trim();
            if (!trimmed) return null;

            const settings = useSettingsStore.getState();
            const existing = settings.emotions.find(
                (emotion) => normalizePresetKey(emotion.name) === normalizePresetKey(trimmed)
            );
            if (existing) {
                return { value: existing, created: false };
            }

            const value: Emotion = { name: trimmed, category };
            await settings.setEmotions([...settings.emotions, value]);
            return { value, created: true };
        },
        []
    );

    const createContextOption = useCallback(
        async (name: string): Promise<EntryPresetCreateResult<string> | null> => {
            const trimmed = name.trim();
            if (!trimmed) return null;

            const settings = useSettingsStore.getState();
            const existing = settings.contexts.find(
                (context) => normalizePresetKey(context) === normalizePresetKey(trimmed)
            );
            if (existing) {
                return { value: existing, created: false };
            }

            await settings.setContexts([...settings.contexts, trimmed]);
            return { value: trimmed, created: true };
        },
        []
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

    return {
        showDetailedLabels,
        emotionOptions: emotions,
        contextOptions: contexts,
        quickEntryPrefs,
        quickEntryFieldConfig,
        detailedFieldConfig,
        createEmotionOption,
        createContextOption,
    };
}

export default useEntrySettings;
