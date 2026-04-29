/**
 * Storage helpers for therapy export preferences.
 *
 * These are intentionally NOT part of settingsStore — therapy export prefs
 * have only one subscriber (therapy-export.tsx) and do not need a global
 * reactive store. See docs/deepening/02-settings-state-desync.md for context.
 */

import { getJson, setJson } from "@/shared/storage/asyncStorage";
import { THERAPY_EXPORT_PREFS_KEY } from "@/shared/storage/keys";
import {
    DEFAULT_THERAPY_EXPORT_PREFS,
    sanitizeTherapyFields,
    type TherapyExportPrefs,
} from "@/lib/entrySettings";

export async function getTherapyExportPrefs(): Promise<TherapyExportPrefs> {
    const data = await getJson<{ fields?: unknown }>(THERAPY_EXPORT_PREFS_KEY);
    if (!data) {
        return DEFAULT_THERAPY_EXPORT_PREFS;
    }
    return { fields: sanitizeTherapyFields(data.fields) };
}

export async function saveTherapyExportPrefs(prefs: TherapyExportPrefs): Promise<void> {
    await setJson(THERAPY_EXPORT_PREFS_KEY, prefs);
}
