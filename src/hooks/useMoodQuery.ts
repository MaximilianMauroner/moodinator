import { useSyncExternalStore } from "react";
import type { MoodQuerySnapshot } from "@/services/moodQueryCache";

export function useMoodQuery<T>(query: {
  getSnapshot: () => MoodQuerySnapshot<T>;
  subscribe: (listener: () => void) => () => void;
  refresh: () => Promise<void>;
}) {
  const snapshot = useSyncExternalStore(query.subscribe, query.getSnapshot);
  return { ...snapshot, refresh: query.refresh };
}
