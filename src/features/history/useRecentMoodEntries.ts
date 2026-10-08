import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import type { MoodEntry } from "@db/types";

import { moodQueries } from "@/services/moodQueries";
import { useMoodQuery } from "@/hooks/useMoodQuery";

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
 * Entries around the last `days` calendar days, with the moment of the latest
 * read attempt (`asOf`). Callers bucket against `asOf`, so after midnight a
 * failed read shows no entries from the previous day as today's. Reads its
 * own range, so history filters and pagination do not change it. Reloads
 * after every entry change, when the screen gains focus, when the app returns
 * to the foreground, and at local midnight.
 */
export function useRecentMoodEntries(days: number) {
  const [asOf, setAsOf] = useState(() => new Date());
  const query = useMemo(() => {
    const dayEnd = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate(), 23, 59, 59, 999);
    return moodQueries.range(getRecentQueryRange(dayEnd, days));
  }, [asOf, days]);
  const result = useMoodQuery(query);
  const reload = useCallback(() => {
    setAsOf(new Date());
    void query.refresh();
  }, [query]);

  useFocusEffect(reload);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") reload();
    });
    const midnight = setTimeout(reload, msUntilNextLocalMidnight(asOf) + 1000);
    return () => {
      subscription.remove();
      clearTimeout(midnight);
    };
  }, [asOf, reload]);

  return {
    entries: result.data ?? EMPTY_ENTRIES,
    asOf,
    loaded: !result.loading && !result.stale,
    error: result.error,
    reload,
  };
}

const EMPTY_ENTRIES: MoodEntry[] = [];
