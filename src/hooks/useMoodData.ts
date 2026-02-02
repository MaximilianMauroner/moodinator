import { useCallback, useEffect } from "react";
import { useMoodsStore } from "@/shared/state/moodsStore";
import type { MoodEntry } from "@db/types";

/**
 * Hook for managing mood data fetching and state.
 * Wraps the Zustand moodsStore for backwards compatibility.
 * @deprecated Use useMoodsStore directly for new code.
 */
export function useMoodData() {
  const moods = useMoodsStore((state) => state.moods);
  const status = useMoodsStore((state) => state.status);
  const lastTracked = useMoodsStore((state) => state.lastTracked);
  const loadAll = useMoodsStore((state) => state.loadAll);
  const refreshMoods = useMoodsStore((state) => state.refreshMoods);
  const setLocal = useMoodsStore((state) => state.setLocal);

  const loading = status === "loading";
  const refreshing = status === "refreshing";

  const fetchMoods = useCallback(async () => {
    await loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    await refreshMoods();
  }, [refreshMoods]);

  // Compatibility wrapper for setMoods
  const setMoods = useCallback(
    (updater: MoodEntry[] | ((prev: MoodEntry[]) => MoodEntry[])) => {
      if (typeof updater === "function") {
        const currentMoods = useMoodsStore.getState().moods;
        setLocal(updater(currentMoods));
      } else {
        setLocal(updater);
      }
    },
    [setLocal]
  );

  // Compatibility wrapper for setLastTracked (computed from moods now)
  const setLastTracked = useCallback(
    (_date: Date) => {
      // lastTracked is now computed from moods in the store
      // This is a no-op for backwards compatibility
    },
    []
  );

  useEffect(() => {
    fetchMoods();
  }, [fetchMoods]);

  return {
    moods,
    setMoods,
    loading,
    refreshing,
    lastTracked,
    setLastTracked,
    fetchMoods,
    onRefresh,
  };
}

export default useMoodData;
