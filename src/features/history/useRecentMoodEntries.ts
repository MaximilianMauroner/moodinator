import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { MoodEntry } from "@db/types";

import { moodService } from "@/services/moodService";
import { useMoodsStore } from "@/shared/state/moodsStore";

/**
 * Entries from the start of the day `days - 1` days ago until now. Reads its
 * own range, so history filters and pagination do not change it. Reloads after
 * every entry change and when the screen gains focus (the day may have turned).
 */
export function useRecentMoodEntries(days: number) {
  const revision = useMoodsStore((state) => state.revision);
  const [reloadCount, setReloadCount] = useState(0);
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setReloadCount((count) => count + 1);
  }, []);

  useFocusEffect(reload);

  useEffect(() => {
    let active = true;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    moodService
      .getInRange({ startDate: start.getTime(), endDate: Date.now() })
      .then((result) => {
        if (!active) return;
        setEntries(result);
        setError(null);
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

  return { entries, error, reload };
}
