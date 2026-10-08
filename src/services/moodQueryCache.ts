/** Shared lifecycle for mood reads. Only subscribed queries reload on a write. */
export type MoodQuerySnapshot<T> = {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  stale: boolean;
};

const invalidators = new Set<() => void>();

export function invalidateMoodQueries() {
  for (const invalidate of invalidators) invalidate();
}

export function createMoodQueryFamily<P, T>(
  keyOf: (params: P) => string,
  load: (params: P) => Promise<T>,
) {
  const queries = new Map<string, ReturnType<typeof createQuery>>();

  function createQuery(params: P, key: string) {
    let snapshot: MoodQuerySnapshot<T> = {
      data: undefined, loading: true, error: null, stale: true,
    };
    let generation = 0;
    let pending: Promise<void> | null = null;
    const listeners = new Set<() => void>();
    const publish = (next: MoodQuerySnapshot<T>) => {
      snapshot = next;
      for (const listener of listeners) listener();
    };
    const refresh = (): Promise<void> => {
      if (pending) return pending;
      const request = generation;
      publish({ ...snapshot, loading: true, error: null });
      const task = Promise.resolve().then(() => load(params)).then(
        (data) => {
          if (request === generation) publish({ data, loading: false, error: null, stale: false });
        },
        (error: unknown) => {
          if (request === generation) publish({
            ...snapshot, loading: false, stale: true,
            error: error instanceof Error ? error.message : "Mood data could not load.",
          });
        },
      ).finally(() => {
        if (pending === task) pending = null;
      });
      pending = task;
      return task;
    };
    const invalidate = () => {
      generation += 1;
      pending = null;
      publish({ ...snapshot, stale: true });
      if (listeners.size) void refresh();
    };
    const query = {
      getSnapshot: () => snapshot,
      refresh,
      subscribe(listener: () => void) {
        queries.set(key, query);
        listeners.add(listener);
        invalidators.add(invalidate);
        if (snapshot.stale && !snapshot.error) void refresh();
        return () => {
          listeners.delete(listener);
          if (listeners.size) return;
          generation += 1;
          snapshot = { ...snapshot, loading: false, stale: true };
          pending = null;
          invalidators.delete(invalidate);
          // React can unsubscribe and immediately subscribe again in StrictMode.
          queueMicrotask(() => {
            if (!listeners.size && queries.get(key) === query) queries.delete(key);
          });
        };
      },
    };
    return query;
  }

  return (params: P) => {
    const key = keyOf(params);
    let query = queries.get(key);
    if (!query) {
      query = createQuery(params, key);
      queries.set(key, query);
    }
    return query;
  };
}
