import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MoodEntry } from "@db/types";
import {
  createMoodEntryWorkflow,
  type MoodEntryWorkflowRepository,
} from "@/services/moodEntryWorkflow";
import {
  commitThenRunPostCommitEffects,
  getMoodEntryPersistenceValues,
  updateMoodEntryOrThrow,
} from "@/lib/moodEntryPersistence";
import type { MoodEntryFormValues } from "@/components/entry/moodEntryDraft";

function makeMood(id: number): MoodEntry {
  return {
    id,
    mood: 4,
    note: "Original",
    timestamp: 1_000,
    utcOffsetMinutes: 0,
    emotions: [],
    contextTags: [],
    energy: null,
    moodScale: { version: 1, min: 0, max: 10, lowerIsBetter: true },
    basedOnEntryId: null,
  };
}

const values: MoodEntryFormValues = {
  mood: 3,
  emotions: [],
  contextTags: [],
  energy: 7,
  note: "Updated",
  basedOnEntryId: 22,
};

describe("mood entry persistence boundaries", () => {
  let repository: MoodEntryWorkflowRepository;
  let moods: MoodEntry[];
  let applyMutation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    moods = [makeMood(1)];
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

  it("keeps a disappeared edit in the modal's failure path", async () => {
    vi.mocked(repository.update).mockResolvedValue(undefined);
    const workflow = createMoodEntryWorkflow(repository, {
      getMoods: () => moods,
      applyMutation,
    });

    await expect(
      updateMoodEntryOrThrow(workflow.update, 1, values),
    ).rejects.toThrow("This entry is no longer available.");

    expect(repository.update).toHaveBeenCalledWith(1, {
      mood: 3,
      note: "Updated",
      emotions: [],
      contextTags: [],
      energy: 7,
      basedOnEntryId: 22,
    });
    expect(applyMutation).not.toHaveBeenCalled();
    expect(moods).toEqual([makeMood(1)]);
  });

  it("keeps post-commit presentation failures out of the save result", async () => {
    const created = makeMood(2);
    vi.mocked(repository.create).mockResolvedValue(created);
    const workflow = createMoodEntryWorkflow(repository, {
      getMoods: () => moods,
      applyMutation,
    });
    const firstEffect = vi.fn(() => {
      throw new Error("scroll ref unavailable");
    });
    const secondEffect = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(
        commitThenRunPostCommitEffects(
          () => workflow.create(getMoodEntryPersistenceValues(values)),
          [firstEffect, secondEffect],
        ),
      ).resolves.toEqual(created);
    } finally {
      errorSpy.mockRestore();
    }

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(firstEffect).toHaveBeenCalledTimes(1);
    expect(secondEffect).toHaveBeenCalledTimes(1);
    expect(applyMutation).toHaveBeenCalledTimes(1);
  });

  it("still propagates a genuine create rejection and skips post-commit effects", async () => {
    const failure = new Error("database rejected");
    vi.mocked(repository.create).mockRejectedValue(failure);
    const workflow = createMoodEntryWorkflow(repository, {
      getMoods: () => moods,
      applyMutation,
    });
    const effect = vi.fn();

    await expect(
      commitThenRunPostCommitEffects(
        () => workflow.create(getMoodEntryPersistenceValues(values)),
        [effect],
      ),
    ).rejects.toBe(failure);

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(effect).not.toHaveBeenCalled();
  });
});
