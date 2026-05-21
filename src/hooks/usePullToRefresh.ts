import { useCallback, useRef, useState } from "react";

const DEFAULT_MIN_REFRESH_MS = 450;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function usePullToRefresh(
  refreshAction: () => Promise<void>,
  minRefreshMs = DEFAULT_MIN_REFRESH_MS
) {
  const [refreshing, setRefreshing] = useState(false);
  const inFlightRefreshRef = useRef<Promise<void> | null>(null);

  const onRefresh = useCallback(() => {
    if (inFlightRefreshRef.current) {
      return inFlightRefreshRef.current;
    }

    setRefreshing(true);
    const startedAt = Date.now();

    const refreshPromise = (async () => {
      try {
        await refreshAction();
      } finally {
        const elapsedMs = Date.now() - startedAt;
        if (elapsedMs < minRefreshMs) {
          await delay(minRefreshMs - elapsedMs);
        }

        inFlightRefreshRef.current = null;
        setRefreshing(false);
      }
    })();

    inFlightRefreshRef.current = refreshPromise;
    return refreshPromise;
  }, [minRefreshMs, refreshAction]);

  return {
    refreshing,
    onRefresh,
  };
}
