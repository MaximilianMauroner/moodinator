import type { Emotion } from "@db/types";
import type {
  MoodEntryFieldConfig,
  MoodEntryFormValues,
} from "./moodEntryDraft";

export type CheckInStage = "mood" | "feelings" | "context";
export type CheckInSheet = "feelings" | "note" | null;
export type CheckInDraft = MoodEntryFormValues;
export type CheckInState =
  | { stage: "mood"; draft: null; sheet: null }
  | { stage: CheckInStage; draft: CheckInDraft; sheet: CheckInSheet };
export type CheckInAction =
  | { type: "mood"; mood: number; fields: MoodEntryFieldConfig }
  | { type: "stage"; stage: CheckInStage }
  | { type: "sheet"; sheet: CheckInSheet }
  | { type: "emotions"; emotions: Emotion[] }
  | { type: "context"; context: string }
  | { type: "energy"; energy: number | null }
  | { type: "note"; note: string }
  | { type: "clear" };

export const MAX_CHECK_IN_FEELINGS = 3;
export const EMPTY_CHECK_IN: CheckInState = {
  stage: "mood",
  draft: null,
  sheet: null,
};

export function checkInReducer(
  state: CheckInState,
  action: CheckInAction,
): CheckInState {
  if (action.type === "clear") return EMPTY_CHECK_IN;
  if (action.type === "mood") {
    return {
      stage: action.fields.emotions ? "feelings" : "context",
      sheet: null,
      draft: {
        emotions: [],
        contextTags: [],
        energy: null,
        note: "",
        basedOnEntryId: null,
        ...state.draft,
        mood: action.mood,
      },
    };
  }
  if (!state.draft) return state;
  switch (action.type) {
    case "stage":
      return { ...state, stage: action.stage, sheet: null };
    case "sheet":
      return { ...state, sheet: action.sheet };
    case "emotions":
      return {
        ...state,
        draft: {
          ...state.draft,
          emotions: action.emotions
            .filter(
              (emotion, index, all) =>
                all.findIndex((other) => other.name === emotion.name) === index,
            )
            .slice(0, MAX_CHECK_IN_FEELINGS),
        },
      };
    case "context":
      return {
        ...state,
        draft: {
          ...state.draft,
          contextTags: state.draft.contextTags.includes(action.context)
            ? state.draft.contextTags.filter((tag) => tag !== action.context)
            : [...state.draft.contextTags, action.context],
        },
      };
    case "energy":
      return { ...state, draft: { ...state.draft, energy: action.energy } };
    case "note":
      return { ...state, draft: { ...state.draft, note: action.note } };
  }
}

export function visibleCheckInFeelings(
  options: readonly Emotion[],
  selected: readonly Emotion[],
): Emotion[] {
  const quickNames = [
    "Happy",
    "Relaxed",
    "Tired",
    "Anxious",
    "Sad",
    "Stressed",
  ];
  const quick = options.filter((emotion) => quickNames.includes(emotion.name));
  const visible = quick.length ? quick : options.slice(0, 6);
  return [
    ...visible,
    ...selected.filter(
      (emotion) => !visible.some((other) => other.name === emotion.name),
    ),
  ];
}
