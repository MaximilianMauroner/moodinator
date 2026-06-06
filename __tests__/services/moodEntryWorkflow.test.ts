import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MoodEntry, MoodEntryInput } from "../../db/types";
import {
  createMoodEntryWorkflow,
  type MoodEntryWorkflowRepository,
} from "../../src/services/moodEntryWorkflow";

function makeMood(id: number, timestamp: number, overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id,
    mood: 4,
    note: null,
    timestamp,
    emotions: [],
    contextTags: [],
    energy: null,
    moodScale: {
      version: 1,
      min: 0,
      max: 10,
      lowerIsBetter: true,
    },
    basedOnEntryId: null,
    ...overrides,
  };
}

describe("createMoodEntryWorkflow", () => {
  let moods: MoodEntry[];
  let repository: MoodEntryWorkflowRepository;
  let applyMutation: ReturnType<typeof vi.fn>;
  let refreshAfterMutation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    moods = [];
    repository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateTimestamp: vi.fn(),
    };
    applyMutation = vi.fn((nextMoods: MoodEntry[]) => {
      moods = nextMoods;
    });
    refreshAfterMutation = vi.fn();
  });

  function workflow() {
    return createMoodEntryWorkflow(repository, {
      getMoods: () => moods,
      applyMutation,
      refreshAfterMutation,
    });
  }

  it("creates a Mood Entry and refreshes the store adapter", async () => {
    const created = makeMood(1, 100);
    vi.mocked(repository.create).mockResolvedValue(created);

    await expect(workflow().create({ mood: 4 })).resolves.toEqual(created);

    expect(moods).toEqual([created]);
    expect(applyMutation).toHaveBeenCalledWith([created]);
    expect(refreshAfterMutation).toHaveBeenCalledTimes(1);
  });

  it("edits a Mood Entry in place", async () => {
    const original = makeMood(1, 100);
    const updated = makeMood(1, 100, { note: "Updated" });
    moods = [original];
    vi.mocked(repository.update).mockResolvedValue(updated);

    await expect(workflow().update(1, { note: "Updated" })).resolves.toEqual(updated);

    expect(moods).toEqual([updated]);
    expect(refreshAfterMutation).toHaveBeenCalledTimes(1);
  });

  it("reschedules a Mood Entry and sorts newest first", async () => {
    const older = makeMood(1, 100);
    const newer = makeMood(2, 200);
    const moved = makeMood(1, 300);
    moods = [newer, older];
    vi.mocked(repository.updateTimestamp).mockResolvedValue(moved);

    await expect(workflow().reschedule(1, 300)).resolves.toEqual(moved);

    expect(moods).toEqual([moved, newer]);
    expect(refreshAfterMutation).toHaveBeenCalledTimes(1);
  });

  it("deletes a Mood Entry and returns the removed snapshot for undo", async () => {
    const existing = makeMood(1, 100);
    moods = [existing];
    vi.mocked(repository.delete).mockResolvedValue(undefined);

    await expect(workflow().delete(1)).resolves.toEqual(existing);

    expect(moods).toEqual([]);
    expect(refreshAfterMutation).toHaveBeenCalledTimes(1);
  });

  it("restores a Mood Entry through the create path", async () => {
    const restored = makeMood(2, 200);
    vi.mocked(repository.create).mockResolvedValue(restored);

    await expect(
      workflow().restore({ mood: 4, timestamp: 200 } satisfies MoodEntryInput)
    ).resolves.toEqual(restored);

    expect(moods).toEqual([restored]);
    expect(refreshAfterMutation).toHaveBeenCalledTimes(1);
  });

  it("undoes delete through the restore workflow", async () => {
    const restored = makeMood(3, 300);
    vi.mocked(repository.create).mockResolvedValue(restored);

    await expect(
      workflow().undoDelete({ mood: 4, timestamp: 300 } satisfies MoodEntryInput)
    ).resolves.toEqual(restored);

    expect(moods).toEqual([restored]);
    expect(refreshAfterMutation).toHaveBeenCalledTimes(1);
  });
});
