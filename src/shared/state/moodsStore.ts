import { create } from "zustand";
import type { MoodEntry, MoodEntryInput } from "@db/types";
import { moodService } from "@/services/moodService";

type LoadStatus = "idle" | "loading" | "error" | "refreshing";

export type MoodsStore = {
  moods: MoodEntry[];
  status: LoadStatus;
  error: string | null;
  lastLoadedAt: number | null;
  isStale: boolean;
  lastTracked: Date | null;

  // Pagination state
  totalCount: number;
  hasMore: boolean;
  currentOffset: number;

  // Actions
  loadAll: () => Promise<void>;
  loadMore: (pageSize?: number) => Promise<void>;
  refreshMoods: () => Promise<void>;
  invalidate: () => void;
  ensureFresh: () => Promise<void>;
  create: (entry: MoodEntryInput) => Promise<MoodEntry>;
  update: (
    id: number,
    updates: Partial<MoodEntryInput & { mood: number }>
  ) => Promise<MoodEntry | null>;
  remove: (id: number) => Promise<MoodEntry | null>;
  restore: (entry: MoodEntryInput) => Promise<MoodEntry>;
  updateTimestamp: (id: number, timestamp: number) => Promise<MoodEntry | null>;
  setLocal: (moods: MoodEntry[]) => void;

  // Selectors
  getMoodById: (id: number) => MoodEntry | undefined;
  getMoodCount: () => number;
};

/**
 * Compute lastTracked date from moods
 */
function computeLastTracked(moods: MoodEntry[]): Date | null {
  if (moods.length === 0) return null;
  const sorted = [...moods].sort((a, b) => b.timestamp - a.timestamp);
  return new Date(sorted[0].timestamp);
}

const DEFAULT_PAGE_SIZE = 50;

function applyCollectionState(moods: MoodEntry[]) {
  return {
    moods,
    lastTracked: computeLastTracked(moods),
    totalCount: moods.length,
    hasMore: false,
    currentOffset: moods.length,
  };
}

export const useMoodsStore = create<MoodsStore>((set, get) => ({
  moods: [],
  status: "idle",
  error: null,
  lastLoadedAt: null,
  isStale: true,
  lastTracked: null,
  totalCount: 0,
  hasMore: false,
  currentOffset: 0,

  setLocal: (moods) =>
    set({
      isStale: false,
      ...applyCollectionState(moods),
    }),

  loadAll: async () => {
    set({ status: "loading", error: null });
    try {
      const moods = await moodService.getAll();
      set({
        moods,
        status: "idle",
        lastLoadedAt: Date.now(),
        isStale: false,
        lastTracked: computeLastTracked(moods),
        totalCount: moods.length,
        hasMore: false,
        currentOffset: moods.length,
      });
    } catch (error) {
      console.error("[moodsStore] Failed to load moods:", error);
      set({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to load moods",
      });
    }
  },

  loadMore: async (pageSize = DEFAULT_PAGE_SIZE) => {
    const { status, currentOffset, hasMore } = get();
    if (status === "loading" || !hasMore) return;

    set({ status: "loading" });
    try {
      const result = await moodService.getPaginated({
        limit: pageSize,
        offset: currentOffset,
      });
      set((state) => ({
        moods: [...state.moods, ...result.data],
        status: "idle",
        totalCount: result.total,
        hasMore: result.hasMore,
        currentOffset: state.currentOffset + result.data.length,
      }));
    } catch (error) {
      console.error("[moodsStore] Failed to load more moods:", error);
      set({ status: "idle" });
    }
  },

  refreshMoods: async () => {
    set({ status: "refreshing" });
    try {
      const moods = await moodService.getAll();
      set({
        moods,
        status: "idle",
        lastLoadedAt: Date.now(),
        isStale: false,
        lastTracked: computeLastTracked(moods),
        totalCount: moods.length,
        hasMore: false,
        currentOffset: moods.length,
      });
    } catch (error) {
      console.error("[moodsStore] Failed to refresh moods:", error);
      set({ status: "idle" }); // Don't overwrite error for refresh failures
    }
  },

  invalidate: () => set({ isStale: true }),

  ensureFresh: async () => {
    const { isStale, status, lastLoadedAt, moods, loadAll, refreshMoods } = get();
    if (!isStale || status === "loading" || status === "refreshing") {
      return;
    }

    if (lastLoadedAt !== null || moods.length > 0) {
      await refreshMoods();
      return;
    }

    await loadAll();
  },

  updateTimestamp: async (id, timestamp) => {
    const updated = await moodService.updateTimestamp(id, timestamp);
    if (!updated) {
      return null;
    }

    set((state) => {
      const newMoods = [...state.moods]
        .map((mood) => (mood.id === id ? updated : mood))
        .sort((a, b) => b.timestamp - a.timestamp);

      return {
        ...applyCollectionState(newMoods),
        isStale: true,
      };
    });

    queueMicrotask(() => {
      void get().ensureFresh();
    });

    return updated;
  },

  create: async (entry) => {
    const created = await moodService.create(entry);
    set((state) => {
      const newMoods = [created, ...state.moods.filter((m) => m.id !== created.id)];
      return {
        ...applyCollectionState(newMoods),
        isStale: true,
      };
    });

    queueMicrotask(() => {
      void get().ensureFresh();
    });

    return created;
  },

  update: async (id, updates) => {
    const updated = await moodService.update(id, updates);
    if (!updated) {
      return null;
    }
    set((state) => {
      const newMoods = state.moods.map((m) => (m.id === id ? updated : m));
      return {
        ...applyCollectionState(newMoods),
        isStale: true,
      };
    });

    queueMicrotask(() => {
      void get().ensureFresh();
    });

    return updated;
  },

  remove: async (id) => {
    const existing = get().moods.find((m) => m.id === id) ?? null;
    await moodService.delete(id);
    set((state) => {
      const newMoods = state.moods.filter((m) => m.id !== id);
      return {
        ...applyCollectionState(newMoods),
        isStale: true,
      };
    });

    queueMicrotask(() => {
      void get().ensureFresh();
    });

    return existing;
  },

  restore: async (entry) => {
    const restored = await moodService.create(entry);
    set((state) => {
      const newMoods = [restored, ...state.moods.filter((m) => m.id !== restored.id)];
      return {
        ...applyCollectionState(newMoods),
        isStale: true,
      };
    });

    queueMicrotask(() => {
      void get().ensureFresh();
    });

    return restored;
  },

  // Selectors
  getMoodById: (id) => get().moods.find((m) => m.id === id),
  getMoodCount: () => get().moods.length,
}));
