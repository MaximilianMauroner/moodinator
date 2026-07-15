import { describe, expect, it } from "vitest";

import {
  buildMoodEntrySubmitValues,
  createMoodEntryFormValues,
  getMoodEntrySteps,
  getNotesPlaceholder,
  resolveMoodEntryBackAction,
} from "../../src/components/entry/moodEntryDraft";

describe("moodEntryDraft", () => {
  const allFields = {
    emotions: true,
    context: true,
    energy: true,
    notes: true,
  };

  it("builds steps from Entry Customization settings", () => {
    expect(getMoodEntrySteps(allFields, true)).toEqual([
      "mood",
      "emotions",
      "details",
    ]);
    expect(
      getMoodEntrySteps(
        { emotions: false, context: false, energy: false, notes: false },
        false
      )
    ).toEqual(["details"]);
  });

  it("keeps Quick Entry across Emotion and Details pages", () => {
    expect(getMoodEntrySteps(allFields, false, "quick")).toEqual([
      "emotions",
      "details",
    ]);
    expect(
      getMoodEntrySteps(
        { emotions: true, context: true, energy: false, notes: false },
        false,
        "quick"
      )
    ).toEqual(["emotions", "details"]);
    expect(
      getMoodEntrySteps(
        { emotions: false, context: true, energy: false, notes: false },
        false,
        "quick"
      )
    ).toEqual(["details"]);
  });

  it("creates an initial draft from existing values", () => {
    expect(
      createMoodEntryFormValues(5, {
        mood: 2,
        note: "Saved",
        energy: 8,
        basedOnEntryId: 12,
      })
    ).toMatchObject({
      mood: 2,
      note: "Saved",
      energy: 8,
      basedOnEntryId: 12,
    });
  });

  it("omits disabled fields from submit values", () => {
    const values = buildMoodEntrySubmitValues(
      {
        mood: 4,
        emotions: [{ name: "Calm", category: "positive" }],
        contextTags: ["Home"],
        energy: 7,
        note: "  Keep this  ",
        basedOnEntryId: 3,
      },
      { emotions: false, context: false, energy: false, notes: false }
    );

    expect(values).toEqual({
      mood: 4,
      emotions: [],
      contextTags: [],
      energy: null,
      note: "",
      basedOnEntryId: 3,
    });
  });

  it("uses inverted Mood Rating severity for notes placeholders", () => {
    expect(getNotesPlaceholder(1)).toContain("good");
    expect(getNotesPlaceholder(9)).toContain("right now");
  });

  it("resolves Android hardware Back without losing in-progress entry state", () => {
    expect(
      resolveMoodEntryBackAction({
        isSaving: true,
        isPresetModalOpen: false,
        isNotesKeyboardActive: false,
        isFirstStep: false,
      })
    ).toBe("ignore");
    expect(
      resolveMoodEntryBackAction({
        isSaving: false,
        isPresetModalOpen: true,
        isNotesKeyboardActive: true,
        isFirstStep: false,
      })
    ).toBe("closePreset");
    expect(
      resolveMoodEntryBackAction({
        isSaving: false,
        isPresetModalOpen: false,
        isNotesKeyboardActive: true,
        isFirstStep: false,
      })
    ).toBe("dismissKeyboard");
    expect(
      resolveMoodEntryBackAction({
        isSaving: false,
        isPresetModalOpen: false,
        isNotesKeyboardActive: false,
        isFirstStep: false,
      })
    ).toBe("previousStep");
    expect(
      resolveMoodEntryBackAction({
        isSaving: false,
        isPresetModalOpen: false,
        isNotesKeyboardActive: false,
        isFirstStep: true,
      })
    ).toBe("closeEntry");
  });
});
