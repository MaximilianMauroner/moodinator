import { create } from "zustand";
import type { MoodEntry, MoodEntryInput } from "@db/types";
import {
  createMoodEntryWorkflow,
  moodService,
} from "@/services/moodService";

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
  return new Date(moods.reduce((latest, mood) => Math.max(latest, mood.timestamp), -Infinity));
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

let activeHydrationPromise: Promise<void> | null = null;

export const useMoodsStore = create<MoodsStore>((set, get) => {
  let collectionRevision = 0;

  const hydrateAll = (
    nextStatus: Extract<LoadStatus, "loading" | "refreshing">,
    options?: { clearError?: boolean }
  ) => {
    if (activeHydrationPromise) {
      return activeHydrationPromise;
    }

    set({
      status: nextStatus,
      ...(options?.clearError ? { error: null } : {}),
    });

    activeHydrationPromise = (async () => {
      try {
        let moods: MoodEntry[];
        while (true) {
          const revision = collectionRevision;
          try {
            moods = await moodService.getAll();
          } catch (error) {
            if (revision === collectionRevision) throw error;
            if (get().isStale) continue;
            set({ status: "idle" });
            return;
          }
          if (revision === collectionRevision) break;
          // A confirmed write or invalidation made this snapshot obsolete.
          if (!get().isStale) {
            set({ status: "idle" });
            return;
          }
        }
        set({
          status: "idle",
          error: null,
          lastLoadedAt: Date.now(),
          isStale: false,
          ...applyCollectionState(moods),
        });
      } catch (error) {
        if (nextStatus === "loading") {
          console.error("[moodsStore] Failed to load moods:", error);
          set({
            status: "error",
            error: error instanceof Error ? error.message : "Failed to load moods",
          });
          return;
        }

        console.error("[moodsStore] Failed to refresh moods:", error);
        const message = error instanceof Error ? error.message : "Failed to refresh moods";
        set((state) => ({
          status: state.moods.length === 0 ? "error" : "idle",
          error: message,
        }));
      } finally {
        activeHydrationPromise = null;
      }
    })();

    return activeHydrationPromise;
  };

  const workflow = createMoodEntryWorkflow(moodService, {
    getMoods: () => get().moods,
    applyMutation: (moods) => {
      collectionRevision += 1;
      set((state) => ({
        ...applyCollectionState(moods),
        isStale: state.isStale || activeHydrationPromise !== null,
      }));
      if (get().isStale && !activeHydrationPromise) {
        void get().ensureFresh();
      }
    },
  });

  return {
    moods: [],
    status: "idle",
    error: null,
    lastLoadedAt: null,
    isStale: true,
    lastTracked: null,
    totalCount: 0,
    hasMore: false,
    currentOffset: 0,

    setLocal: (moods) => {
      collectionRevision += 1;
      set({
        status: "idle",
        error: null,
        isStale: false,
        ...applyCollectionState(moods),
      });
    },

    loadAll: () => hydrateAll("loading", { clearError: true }),

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
          error: null,
          totalCount: result.total,
          hasMore: result.hasMore,
          currentOffset: state.currentOffset + result.data.length,
        }));
      } catch (error) {
        console.error("[moodsStore] Failed to load more moods:", error);
        set({
          status: "idle",
          error: error instanceof Error ? error.message : "Failed to load more moods",
        });
      }
    },

    refreshMoods: () => hydrateAll("refreshing"),

    invalidate: () => {
      collectionRevision += 1;
      set({ isStale: true });
    },

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
      return workflow.reschedule(id, timestamp);
    },

    create: async (entry) => {
      return workflow.create(entry);
    },

    update: async (id, updates) => {
      return workflow.update(id, updates);
    },

    remove: async (id) => {
      return workflow.delete(id);
    },

    restore: async (entry) => {
      return workflow.restore(entry);
    },

    // Selectors
    getMoodById: (id) => get().moods.find((m) => m.id === id),
    getMoodCount: () => get().moods.length,
  };
});
