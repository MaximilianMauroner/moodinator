import { useMemo } from "react";
import { useSettingsStore } from "@/shared/state/settingsStore";

// detailedFieldConfig never changes — all fields are always shown in
// detailed mode. Module-level constant avoids re-creating it each render.
const detailedFieldConfig = {
    emotions: true,
    context: true,
    energy: true,
    notes: true,
} as const;

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
    };
}

export default useEntrySettings;
