import type { MoodEntry, MoodEntryInput } from "@db/types";

export interface MoodEntryWorkflowRepository {
  create: (entry: MoodEntryInput) => Promise<MoodEntry>;
  update: (
    id: number,
    updates: Partial<MoodEntryInput & { mood: number }>
  ) => Promise<MoodEntry | undefined>;
  delete: (id: number) => Promise<void>;
  updateTimestamp: (
    id: number,
    timestamp: number
  ) => Promise<MoodEntry | undefined>;
}

export interface MoodEntryWorkflowStoreAdapter {
  getMoods: () => MoodEntry[];
  applyMutation: (moods: MoodEntry[]) => void;
  refreshAfterMutation: () => void;
}

function withoutExistingEntry(moods: MoodEntry[], id: number): MoodEntry[] {
  return moods.filter((mood) => mood.id !== id);
}

function sortNewestFirst(moods: MoodEntry[]): MoodEntry[] {
  return [...moods].sort((a, b) => b.timestamp - a.timestamp);
}

function commitMutation(
  store: MoodEntryWorkflowStoreAdapter,
  moods: MoodEntry[]
) {
  store.applyMutation(moods);
  store.refreshAfterMutation();
}

export function createMoodEntryWorkflow(
  repository: MoodEntryWorkflowRepository,
  store: MoodEntryWorkflowStoreAdapter
) {
  return {
    async create(entry: MoodEntryInput): Promise<MoodEntry> {
      const created = await repository.create(entry);
      commitMutation(store, [created, ...withoutExistingEntry(store.getMoods(), created.id)]);
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
        store.getMoods().map((mood) => (mood.id === id ? updated : mood))
      );
      return updated;
    },

    async reschedule(id: number, timestamp: number): Promise<MoodEntry | null> {
      const updated = await repository.updateTimestamp(id, timestamp);
      if (!updated) {
        return null;
      }

      commitMutation(
        store,
        sortNewestFirst(
          store.getMoods().map((mood) => (mood.id === id ? updated : mood))
        )
      );
      return updated;
    },

    async delete(id: number): Promise<MoodEntry | null> {
      const existing = store.getMoods().find((mood) => mood.id === id) ?? null;
      await repository.delete(id);
      commitMutation(store, withoutExistingEntry(store.getMoods(), id));
      return existing;
    },

    async restore(entry: MoodEntryInput): Promise<MoodEntry> {
      const restored = await repository.create(entry);
      commitMutation(store, [restored, ...withoutExistingEntry(store.getMoods(), restored.id)]);
      return restored;
    },

    async undoDelete(entry: MoodEntryInput): Promise<MoodEntry> {
      const restored = await repository.create(entry);
      commitMutation(store, [restored, ...withoutExistingEntry(store.getMoods(), restored.id)]);
      return restored;
    },
  };
}
