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
import { getInterpretedMoodRating } from "@/constants/moodScaleInterpretation";
import {
  CURRENT_MOOD_SCALE_SNAPSHOT,
  LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT,
} from "../../domain/moodScale";

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
      updateMoodEntryOrThrow(workflow.update, moods[0]!, values),
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

  it.each([
    [CURRENT_MOOD_SCALE_SNAPSHOT, 0, CURRENT_MOOD_SCALE_SNAPSHOT, 0, 0],
    [CURRENT_MOOD_SCALE_SNAPSHOT, 10, CURRENT_MOOD_SCALE_SNAPSHOT, 10, 10],
    [CURRENT_MOOD_SCALE_SNAPSHOT, 1, LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT, 1, 9],
    [CURRENT_MOOD_SCALE_SNAPSHOT, 0, LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT, 0, 10],
    [CURRENT_MOOD_SCALE_SNAPSHOT, 10, LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT, 10, 0],
    [LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT, 10, CURRENT_MOOD_SCALE_SNAPSHOT, 0, 0],
    [LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT, 0, CURRENT_MOOD_SCALE_SNAPSHOT, 10, 10],
    [LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT, 9, LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT, 1, 9],
    [LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT, 10, LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT, 0, 10],
    [LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT, 0, LEGACY_HIGHER_IS_BETTER_MOOD_SCALE_SNAPSHOT, 10, 0],
  ] as const)("preserves copied mood meaning across stored scales (case %#)", async (
    sourceScale, sourceMood, destinationScale, formMood, storedMood,
  ) => {
    const source = { ...makeMood(22), mood: sourceMood, moodScale: sourceScale };
    const destination = { ...makeMood(1), moodScale: destinationScale };
    const copiedValues: MoodEntryFormValues = {
      mood: getInterpretedMoodRating(source),
      emotions: [{ name: "Custom calm", category: "positive", icon: null }],
      contextTags: ["Custom place"],
      energy: 0,
      note: "  copied \u0000 and café  ",
      basedOnEntryId: source.id,
    };
    vi.mocked(repository.update).mockResolvedValue(destination);

    expect(copiedValues.mood).toBe(formMood);
    await updateMoodEntryOrThrow(repository.update, destination, copiedValues);

    expect(repository.update).toHaveBeenCalledExactlyOnceWith(destination.id, {
      mood: storedMood,
      note: copiedValues.note,
      emotions: copiedValues.emotions,
      contextTags: copiedValues.contextTags,
      energy: 0,
      basedOnEntryId: source.id,
    });
    expect(destination).toEqual({ ...makeMood(1), moodScale: destinationScale });
    expect(source).toEqual({ ...makeMood(22), mood: sourceMood, moodScale: sourceScale });
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
