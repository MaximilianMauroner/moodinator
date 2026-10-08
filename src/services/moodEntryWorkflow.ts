import type { MoodEntry, MoodEntryInput } from "@db/types";

export interface MoodEntryWorkflowRepository {
  create: (entry: MoodEntryInput) => Promise<MoodEntry>;
  update: (
    id: number,
    updates: Partial<MoodEntryInput & { mood: number }>
  ) => Promise<MoodEntry | undefined>;
  delete: (id: number) => Promise<boolean>;
  updateTimestamp: (
    id: number,
    timestamp: number,
    utcOffsetMinutes?: number | null,
  ) => Promise<MoodEntry | undefined>;
}

export type MoodMutation =
  | { type: "insert" }
  | { type: "update" }
  | { type: "delete"; deleted: boolean };

export interface MoodEntryWorkflowStoreAdapter {
  getMoods: () => MoodEntry[];
  applyMutation: (moods: MoodEntry[], mutation: MoodMutation) => void;
}

function withoutExistingEntry(moods: MoodEntry[], id: number): MoodEntry[] {
  return moods.filter((mood) => mood.id !== id);
}

function sortNewestFirst(moods: MoodEntry[]): MoodEntry[] {
  return [...moods].sort((a, b) => b.timestamp - a.timestamp || b.id - a.id);
}

function commitMutation(
  store: MoodEntryWorkflowStoreAdapter,
  moods: MoodEntry[],
  mutation: MoodMutation
) {
  store.applyMutation(sortNewestFirst(moods), mutation);
}

export function createMoodEntryWorkflow(
  repository: MoodEntryWorkflowRepository,
  store: MoodEntryWorkflowStoreAdapter
) {
  return {
    async create(entry: MoodEntryInput): Promise<MoodEntry> {
      const created = await repository.create(entry);
      commitMutation(store, [created, ...withoutExistingEntry(store.getMoods(), created.id)], { type: "insert" });
      return created;
    },

    async update(
      id: number,
      updates: Partial<MoodEntryInput & { mood: number }>
    ): Promise<MoodEntry | null> {
      const updated = await repository.update(id, updates);
      if (!updated) {
        return null;
      }

      commitMutation(
        store,
        store.getMoods().map((mood) => (mood.id === id ? updated : mood)),
        { type: "update" }
      );
      return updated;
    },

    async reschedule(
      id: number,
      timestamp: number,
      utcOffsetMinutes?: number | null,
    ): Promise<MoodEntry | null> {
      const updated = await repository.updateTimestamp(id, timestamp, utcOffsetMinutes);
      if (!updated) {
        return null;
      }

      commitMutation(
        store,
        store.getMoods().map((mood) => (mood.id === id ? updated : mood)),
        { type: "update" }
      );
      return updated;
    },

    async delete(id: number): Promise<MoodEntry | null> {
      const existing = store.getMoods().find((mood) => mood.id === id) ?? null;
      const deleted = await repository.delete(id);
      commitMutation(store, withoutExistingEntry(store.getMoods(), id), { type: "delete", deleted });
      return existing;
    },

    async restore(entry: MoodEntryInput): Promise<MoodEntry> {
      const restored = await repository.create(entry);
      commitMutation(store, [restored, ...withoutExistingEntry(store.getMoods(), restored.id)], { type: "insert" });
      return restored;
    },
  };
}
