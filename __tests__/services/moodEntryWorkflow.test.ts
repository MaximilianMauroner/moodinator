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
  });

  function workflow() {
    return createMoodEntryWorkflow(repository, {
      getMoods: () => moods,
      applyMutation,
    });
  }

  it("creates a Mood Entry and updates the store adapter", async () => {
    const created = makeMood(1, 100);
    vi.mocked(repository.create).mockResolvedValue(created);

    await expect(workflow().create({ mood: 4 })).resolves.toEqual(created);

    expect(moods).toEqual([created]);
    expect(applyMutation).toHaveBeenCalledWith([created]);
  });

  it.each(["create", "restore", "undoDelete"] as const)("keeps a backdated %s in timestamp order", async (action) => {
    const newer = makeMood(1, 200);
    const backdated = makeMood(2, 100);
    moods = [newer];
    vi.mocked(repository.create).mockResolvedValue(backdated);
    await workflow()[action]({ mood: 4, timestamp: 100 });
    expect(moods).toEqual([newer, backdated]);
  });

  it("reorders a timestamp changed through the general update action", async () => {
    const newer = makeMood(1, 200);
    const moved = makeMood(2, 300);
    moods = [newer, makeMood(2, 100)];
    vi.mocked(repository.update).mockResolvedValue(moved);
    await workflow().update(2, { timestamp: 300 });
    expect(moods).toEqual([moved, newer]);
  });

  it("edits a Mood Entry in place", async () => {
    const original = makeMood(1, 100);
    const updated = makeMood(1, 100, { note: "Updated" });
    moods = [original];
    vi.mocked(repository.update).mockResolvedValue(updated);

    await expect(workflow().update(1, { note: "Updated" })).resolves.toEqual(updated);

    expect(moods).toEqual([updated]);
  });

  it("reschedules a Mood Entry and sorts newest first", async () => {
    const older = makeMood(1, 100);
    const newer = makeMood(2, 200);
    const moved = makeMood(1, 300);
    moods = [newer, older];
    vi.mocked(repository.updateTimestamp).mockResolvedValue(moved);

    await expect(workflow().reschedule(1, 300)).resolves.toEqual(moved);

    expect(moods).toEqual([moved, newer]);
  });

  it("deletes a Mood Entry and returns the removed snapshot for undo", async () => {
    const existing = makeMood(1, 100);
    moods = [existing];
    vi.mocked(repository.delete).mockResolvedValue(undefined);

    await expect(workflow().delete(1)).resolves.toEqual(existing);

    expect(moods).toEqual([]);
  });

  it("restores a Mood Entry through the create path", async () => {
    const restored = makeMood(2, 200);
    vi.mocked(repository.create).mockResolvedValue(restored);

    await expect(
      workflow().restore({ mood: 4, timestamp: 200 } satisfies MoodEntryInput)
    ).resolves.toEqual(restored);

    expect(moods).toEqual([restored]);
  });

  it("undoes delete through the restore workflow", async () => {
    const restored = makeMood(3, 300);
    vi.mocked(repository.create).mockResolvedValue(restored);

    await expect(
      workflow().undoDelete({ mood: 4, timestamp: 300 } satisfies MoodEntryInput)
    ).resolves.toEqual(restored);

    expect(moods).toEqual([restored]);
  });
});
