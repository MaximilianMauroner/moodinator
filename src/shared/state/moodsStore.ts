import { create } from "zustand";
import type { MoodEntry, MoodEntryInput } from "@db/types";
import {
  createMoodEntryWorkflow,
  moodService,
  type MoodHistoryFilters,
} from "@/services/moodService";

export const HISTORY_PAGE_SIZE = 50;

type LoadStatus = "idle" | "loading" | "error" | "refreshing";

export type MoodsStore = {
  moods: MoodEntry[];
  revision: number;
  filters: MoodHistoryFilters;
  hasMore: boolean;
  total: number;
  loadingMore: boolean;
  loadMore: () => Promise<void>;
  setFilters: (filters: MoodHistoryFilters) => Promise<void>;
  clearFilters: () => Promise<void>;
  status: LoadStatus;
  error: string | null;
  lastLoadedAt: number | null;
  isStale: boolean;

  // Actions
  loadAll: () => Promise<void>;
  refreshMoods: () => Promise<void>;
  invalidate: () => void;
  ensureFresh: () => Promise<void>;
  create: (entry: MoodEntryInput) => Promise<MoodEntry>;
  update: (
    id: number,
    updates: Partial<MoodEntryInput & { mood: number }>,
  ) => Promise<MoodEntry | null>;
  remove: (id: number) => Promise<MoodEntry | null>;
  restore: (entry: MoodEntryInput) => Promise<MoodEntry>;
  updateTimestamp: (id: number, timestamp: number) => Promise<MoodEntry | null>;
  setLocal: (moods: MoodEntry[]) => void;
};

let activeHydrationPromise: Promise<void> | null = null;

export const useMoodsStore = create<MoodsStore>((set, get) => {
  let collectionRevision = 0;
  let pagePromise: Promise<void> | null = null;

  const hydrateAll = (
    nextStatus: Extract<LoadStatus, "loading" | "refreshing">,
    options?: { clearError?: boolean },
  ) => {
    if (activeHydrationPromise) {
      return activeHydrationPromise;
    }

    // Replacing the window also invalidates any page requested from its old end.
    collectionRevision += 1;
    set({
      status: nextStatus,
      ...(options?.clearError ? { error: null } : {}),
    });

    activeHydrationPromise = (async () => {
      try {
        let page: Awaited<ReturnType<typeof moodService.getPaginated>>;
        while (true) {
          const revision = collectionRevision;
          try {
            page = await moodService.getPaginated({
              limit: HISTORY_PAGE_SIZE,
              offset: 0,
              filters: get().filters,
            });
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
          moods: page.data,
          total: page.total,
          hasMore: page.hasMore,
        });
      } catch (error) {
        if (nextStatus === "loading") {
          console.error("[moodsStore] Failed to load moods:", error);
          set({
            status: "error",
            error:
              error instanceof Error ? error.message : "Failed to load moods",
          });
          return;
        }

        console.error("[moodsStore] Failed to refresh moods:", error);
        const message =
          error instanceof Error ? error.message : "Failed to refresh moods";
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
        moods: Object.keys(state.filters).length
          ? moods.filter((entry) =>
              state.moods.some((existing) => existing.id === entry.id),
            )
          : moods.slice(0, HISTORY_PAGE_SIZE),
        revision: state.revision + 1,
        isStale: true,
      }));
      if (get().isStale && !activeHydrationPromise) {
        void get().ensureFresh();
      }
    },
  });

  return {
    moods: [],
    revision: 0,
    filters: {},
    total: 0,
    hasMore: false,
    loadingMore: false,

    setFilters: async (filters) => {
      collectionRevision += 1;
      set({ filters, moods: [], hasMore: false, total: 0, isStale: true });
      await hydrateAll("loading", { clearError: true });
    },
    clearFilters: () => get().setFilters({}),

    loadMore: () => {
      if (pagePromise) return pagePromise;
      if (!get().hasMore || get().isStale || activeHydrationPromise)
        return Promise.resolve();
      const revision = collectionRevision;
      const offset = get().moods.length;
      set({ loadingMore: true });
      pagePromise = (async () => {
        try {
          const page = await moodService.getPaginated({
            limit: HISTORY_PAGE_SIZE,
            offset,
            filters: get().filters,
          });
          if (revision !== collectionRevision || activeHydrationPromise) return;
          set((state) => {
            const existingIds = new Set(state.moods.map((entry) => entry.id));
            return {
              moods: [
                ...state.moods,
                ...page.data.filter((entry) => !existingIds.has(entry.id)),
              ],
              total: page.total,
              hasMore: page.hasMore,
              error: null,
            };
          });
        } catch (error) {
          if (revision === collectionRevision)
            set({
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to load more moods",
            });
        } finally {
          pagePromise = null;
          set({ loadingMore: false });
        }
      })();
      return pagePromise;
    },
    status: "idle",
    error: null,
    lastLoadedAt: null,
    isStale: true,

    setLocal: (moods) => {
      collectionRevision += 1;
      set({
        status: "idle",
        error: null,
        isStale: false,
        revision: get().revision + 1,
        hasMore: false,
        total: moods.length,
        moods,
      });
    },

    loadAll: () => hydrateAll("loading", { clearError: true }),

    refreshMoods: () => hydrateAll("refreshing"),

    invalidate: () => {
      collectionRevision += 1;
      set((state) => ({ isStale: true, revision: state.revision + 1 }));
    },

    ensureFresh: async () => {
      if (activeHydrationPromise) return activeHydrationPromise;
      const { isStale, status, lastLoadedAt, moods, loadAll, refreshMoods } =
        get();
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
  };
});
