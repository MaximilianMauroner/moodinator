import { create } from "zustand";
import type { MoodEntry, MoodEntryInput } from "@db/types";
import {
  deleteMood,
  getAllMoods,
  insertMoodEntry,
  updateMoodEntry,
} from "@db/db";

type LoadStatus = "idle" | "loading" | "error";

export type MoodsStore = {
  moods: MoodEntry[];
  status: LoadStatus;
  error: string | null;
  lastLoadedAt: number | null;

  loadAll: () => Promise<void>;
  create: (entry: MoodEntryInput) => Promise<MoodEntry>;
  update: (
    id: number,
    updates: Partial<MoodEntryInput & { mood: number }>
  ) => Promise<MoodEntry | null>;
  remove: (id: number) => Promise<MoodEntry | null>;
  restore: (entry: Omit<MoodEntry, "id">) => Promise<MoodEntry>;
  setLocal: (moods: MoodEntry[]) => void;
};

export const useMoodsStore = create<MoodsStore>((set, get) => ({
  moods: [],
  status: "idle",
  error: null,
  lastLoadedAt: null,

  setLocal: (moods) => set({ moods }),

  loadAll: async () => {
    set({ status: "loading", error: null });
    try {
      const moods = await getAllMoods();
      set({
        moods,
        status: "idle",
        lastLoadedAt: Date.now(),
      });
    } catch (error) {
      console.error("[moodsStore] Failed to load moods:", error);
      set({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to load moods",
      });
    }
  },

  create: async (entry) => {
    const created = await insertMoodEntry(entry);
    set((state) => ({
      moods: [created, ...state.moods.filter((m) => m.id !== created.id)],
    }));
    return created;
  },

  update: async (id, updates) => {
    const updated = await updateMoodEntry(id, updates);
    if (!updated) {
      return null;
    }
    set((state) => ({
      moods: state.moods.map((m) => (m.id === id ? updated : m)),
    }));
    return updated;
  },

  remove: async (id) => {
    const existing = get().moods.find((m) => m.id === id) ?? null;
    await deleteMood(id);
    set((state) => ({
      moods: state.moods.filter((m) => m.id !== id),
    }));
    return existing;
  },

  restore: async (entry) => {
    const restored = await insertMoodEntry(entry);
    set((state) => ({
      moods: [restored, ...state.moods.filter((m) => m.id !== restored.id)],
    }));
    return restored;
  },
}));

