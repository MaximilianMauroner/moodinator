import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import type { MoodEntry } from "@db/types";

import { moodService } from "@/services/moodService";
import { useMoodsStore } from "@/shared/state/moodsStore";

const HOUR_MS = 60 * 60 * 1000;
/**
 * Recorded offsets span UTC-12 to UTC+14, so a recorded local day can start
 * up to 26 hours away from this device's local midnight for the same date.
 */
const RECORDED_DAY_PADDING_MS = 26 * HOUR_MS;

/**
 * Query window for the last `days` calendar days as of `now`. It is wide
 * enough that every entry whose recorded local day falls in those days is
 * returned; callers then bucket by recorded day (`buildForecastDays`).
 */
export function getRecentQueryRange(now: Date, days: number): { startDate: number; endDate: number } {
  const firstDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  return {
    startDate: firstDay.getTime() - RECORDED_DAY_PADDING_MS,
    endDate: now.getTime() + RECORDED_DAY_PADDING_MS,
  };
}

function msUntilNextLocalMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

/**
 * Entries around the last `days` calendar days, with the moment they were
 * read (`asOf`). Reads its own range, so history filters and pagination do not
 * change it. Reloads after every entry change, when the screen gains focus,
 * when the app returns to the foreground, and at local midnight.
 */
export function useRecentMoodEntries(days: number) {
  const revision = useMoodsStore((state) => state.revision);
  const [reloadCount, setReloadCount] = useState(0);
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [asOf, setAsOf] = useState(() => new Date());
  /** True only while the latest read has completed. */
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setReloadCount((count) => count + 1);
  }, []);

  useFocusEffect(reload);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") reload();
    });
    return () => subscription.remove();
  }, [reload]);

  useEffect(() => {
    let active = true;
    const now = new Date();
    setLoaded(false);

    moodService
      .getInRange(getRecentQueryRange(now, days))
      .then((result) => {
        if (!active) return;
        setEntries(result);
        setAsOf(now);
        setError(null);
        setLoaded(true);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        console.error("[useRecentMoodEntries] Failed to load recent entries:", cause);
        setError("Recent entries could not load.");
      });

    const midnight = setTimeout(reload, msUntilNextLocalMidnight(now) + 1000);
    return () => {
      active = false;
      clearTimeout(midnight);
    };
  }, [days, revision, reloadCount, reload]);

  return { entries, asOf, loaded, error, reload };
}
