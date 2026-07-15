import type { Emotion } from "@db/types";

export type MoodEntryFormValues = {
  mood: number;
  emotions: Emotion[];
  contextTags: string[];
  energy: number | null;
  note: string;
  basedOnEntryId: number | null;
};

export type MoodEntryFieldConfig = {
  emotions: boolean;
  context: boolean;
  energy: boolean;
  notes: boolean;
};

export type MoodEntryFlow = "quick" | "detailed";

export type MoodEntryStepId = "mood" | "emotions" | "details";

export type MoodEntryBackAction =
  | "ignore"
  | "dismissKeyboard"
  | "closePreset"
  | "previousStep"
  | "closeEntry";

export type MoodEntryBackState = {
  isSaving: boolean;
  isPresetModalOpen: boolean;
  isNotesKeyboardActive: boolean;
  isFirstStep: boolean;
};

export function getNotesPlaceholder(mood: number): string {
  if (mood <= 2) return "What's making this day so good?";
  if (mood <= 4) return "What's on your mind today?";
  if (mood <= 6) return "What's weighing on you? Capturing it can help.";
  return "What's happening right now? You don't have to hold it alone.";
}

export function resolveMoodEntryBackAction(
  state: MoodEntryBackState
): MoodEntryBackAction {
  if (state.isSaving) return "ignore";
  if (state.isPresetModalOpen) return "closePreset";
  if (state.isNotesKeyboardActive) return "dismissKeyboard";
  return state.isFirstStep ? "closeEntry" : "previousStep";
}

export function getMoodEntrySteps(
  fieldConfig: MoodEntryFieldConfig,
  showMoodSelector: boolean,
  flow: MoodEntryFlow = "detailed"
): MoodEntryStepId[] {
  const steps: MoodEntryStepId[] = [];
  if (showMoodSelector) steps.push("mood");

  if (fieldConfig.emotions && (flow === "quick" || flow === "detailed")) {
    steps.push("emotions");
  }
  if (fieldConfig.context || fieldConfig.energy || fieldConfig.notes) {
    steps.push("details");
  }

  return steps.length ? steps : ["details"];
}

export function createMoodEntryFormValues(
  initialMood: number,
  initialValues?: Partial<MoodEntryFormValues>
): MoodEntryFormValues {
  return {
    mood: initialValues?.mood ?? initialMood,
    emotions: initialValues?.emotions ?? [],
    contextTags: initialValues?.contextTags ?? [],
    energy:
      initialValues && typeof initialValues.energy === "number"
        ? initialValues.energy
        : null,
    note: initialValues?.note ?? "",
    basedOnEntryId: initialValues?.basedOnEntryId ?? null,
  };
}

export function buildMoodEntrySubmitValues(
  values: MoodEntryFormValues,
  fieldConfig: MoodEntryFieldConfig
): MoodEntryFormValues {
  return {
    mood: values.mood,
    emotions: fieldConfig.emotions ? values.emotions : [],
    contextTags: fieldConfig.context ? values.contextTags : [],
    energy: fieldConfig.energy ? values.energy : null,
    note: fieldConfig.notes ? values.note.trim() : "",
    basedOnEntryId: values.basedOnEntryId,
  };
}
