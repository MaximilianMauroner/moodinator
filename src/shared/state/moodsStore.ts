import { create } from "zustand";
import type { MoodEntry, MoodEntryInput } from "@db/types";
import { moodService } from "@/services/moodService";

type LoadStatus = "idle" | "loading" | "error" | "refreshing";

export type MoodsStore = {
  moods: MoodEntry[];
  status: LoadStatus;
  error: string | null;
  lastLoadedAt: number | null;
  lastTracked: Date | null;

  // Actions
  loadAll: () => Promise<void>;
  refreshMoods: () => Promise<void>;
  create: (entry: MoodEntryInput) => Promise<MoodEntry>;
  update: (
    id: number,
    updates: Partial<MoodEntryInput & { mood: number }>
  ) => Promise<MoodEntry | null>;
  remove: (id: number) => Promise<MoodEntry | null>;
  restore: (entry: Omit<MoodEntry, "id">) => Promise<MoodEntry>;
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

export const useMoodsStore = create<MoodsStore>((set, get) => ({
  moods: [],
  status: "idle",
  error: null,
  lastLoadedAt: null,
  lastTracked: null,

  setLocal: (moods) =>
    set({
      moods,
      lastTracked: computeLastTracked(moods),
    }),

  loadAll: async () => {
    set({ status: "loading", error: null });
    try {
      const moods = await moodService.getAll();
      set({
        moods,
        status: "idle",
        lastLoadedAt: Date.now(),
        lastTracked: computeLastTracked(moods),
      });
    } catch (error) {
      console.error("[moodsStore] Failed to load moods:", error);
      set({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to load moods",
      });
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
        lastTracked: computeLastTracked(moods),
      });
    } catch (error) {
      console.error("[moodsStore] Failed to refresh moods:", error);
      set({ status: "idle" }); // Don't overwrite error for refresh failures
    }
  },

  create: async (entry) => {
    const created = await moodService.create(entry);
    set((state) => {
      const newMoods = [created, ...state.moods.filter((m) => m.id !== created.id)];
      return {
        moods: newMoods,
        lastTracked: computeLastTracked(newMoods),
      };
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
        moods: newMoods,
        lastTracked: computeLastTracked(newMoods),
      };
    });
    return updated;
  },

  remove: async (id) => {
    const existing = get().moods.find((m) => m.id === id) ?? null;
    await moodService.delete(id);
    set((state) => {
      const newMoods = state.moods.filter((m) => m.id !== id);
      return {
        moods: newMoods,
        lastTracked: computeLastTracked(newMoods),
      };
    });
    return existing;
  },

  restore: async (entry) => {
    const restored = await moodService.create(entry);
    set((state) => {
      const newMoods = [restored, ...state.moods.filter((m) => m.id !== restored.id)];
      return {
        moods: newMoods,
        lastTracked: computeLastTracked(newMoods),
      };
    });
    return restored;
  },

  // Selectors
  getMoodById: (id) => get().moods.find((m) => m.id === id),
  getMoodCount: () => get().moods.length,
}));

