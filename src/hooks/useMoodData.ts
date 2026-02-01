import { useState, useCallback, useEffect } from "react";
import { getAllMoods } from "@db/db";
import type { MoodEntry } from "@db/types";

/**
 * Hook for managing mood data fetching and state.
 * Handles loading, refreshing, and tracking the last logged mood.
 */
export function useMoodData() {
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastTracked, setLastTracked] = useState<Date | null>(null);

  const fetchMoods = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllMoods();
      setMoods(data);
      if (data.length > 0) {
        setLastTracked(new Date(data[0].timestamp));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refreshMoods = useCallback(async () => {
    try {
      const data = await getAllMoods();
      setMoods(data);
      if (data.length > 0) {
        setLastTracked(new Date(data[0].timestamp));
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshMoods();
  }, [refreshMoods]);

  useEffect(() => {
    fetchMoods();
  }, []);

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
