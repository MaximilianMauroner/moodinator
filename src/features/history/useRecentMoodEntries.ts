import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { MoodEntry } from "@db/types";

import { moodService } from "@/services/moodService";
import { useMoodsStore } from "@/shared/state/moodsStore";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Entries around the last `days` calendar days. Callers bucket them by each
 * entry's recorded local day (`buildForecastDays`), so the query is padded by
 * one day on each side: an entry recorded in another time zone can sit up to
 * 28 hours away from this device's day boundaries. Reads its own range, so
 * history filters and pagination do not change it. Reloads after every entry
 * change and when the screen gains focus (the day may have turned).
 */
export function useRecentMoodEntries(days: number) {
  const revision = useMoodsStore((state) => state.revision);
  const [reloadCount, setReloadCount] = useState(0);
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setReloadCount((count) => count + 1);
  }, []);

  useFocusEffect(reload);

  useEffect(() => {
    let active = true;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - days);
    const end = Date.now() + DAY_MS;

    moodService
      .getInRange({ startDate: start.getTime(), endDate: end })
      .then((result) => {
        if (!active) return;
        setEntries(result);
        setError(null);
        setLoaded(true);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        console.error("[useRecentMoodEntries] Failed to load recent entries:", cause);
        setError("Recent entries could not load.");
      });

    return () => {
      active = false;
    };
  }, [days, revision, reloadCount]);

  return { entries, loaded, error, reload };
}
