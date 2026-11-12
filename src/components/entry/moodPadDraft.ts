import type { Emotion } from "@db/types";
import {
  resolveEmotionEnergyBand,
  type EmotionEnergyBand,
} from "@/lib/entrySettings";
export type PadLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type MoodPadDraft = {
  mood: PadLevel;
  energy: PadLevel;
  emotions: Emotion[];
  contextTags: string[];
  note: string;
};
export type MoodPadState =
  | {
      draft: null;
      view: "pad";
    }
  | {
      draft: MoodPadDraft;
      view: "pad" | "note" | "more";
    };
export type MoodPadAction =
  | {
      type: "point";
      mood: number;
      energy: number;
    }
  | {
      type: "emotions";
      emotions: Emotion[];
    }
  | {
      type: "context";
      context: string;
    }
  | {
      type: "note";
      note: string;
    }
  | {
      type: "view";
      view: MoodPadState["view"];
    }
  | {
      type: "clear";
    };
export const MAX_PAD_EMOTIONS = 3;
export const EMPTY_MOOD_PAD: MoodPadState = {
  draft: null,
  view: "pad",
};
function padLevel(value: number): PadLevel {
  return Math.max(0, Math.min(10, Math.round(value))) as PadLevel;
}
export function moodPadPoint(
  x: number,
  y: number,
  width: number,
  height: number,
) {
  return {
    mood: padLevel(Math.floor((x / width) * 11)),
    energy: padLevel(10 - Math.floor((y / height) * 11)),
  };
}
export function moodPadReducer(
  state: MoodPadState,
  action: MoodPadAction,
): MoodPadState {
  if (action.type === "clear") return EMPTY_MOOD_PAD;
  if (action.type === "point") {
    return {
      view: "pad",
      draft: {
        emotions: [],
        contextTags: [],
        note: "",
        ...state.draft,
        mood: padLevel(action.mood),
        energy: padLevel(action.energy),
      },
    };
  }
  if (!state.draft) return state;
  const draft = state.draft;
  switch (action.type) {
    case "view":
      return {
        draft,
        view: action.view,
      };
    case "note":
      return {
        ...state,
        draft: {
          ...draft,
          note: action.note,
        },
      };
    case "emotions": {
      const unique = action.emotions.filter(
        (emotion, index, all) =>
          all.findIndex((other) => other.name === emotion.name) === index,
      );
      return {
        ...state,
        draft: {
          ...draft,
          emotions: unique.slice(0, MAX_PAD_EMOTIONS),
        },
      };
    }
    case "context":
      return {
        ...state,
        draft: {
          ...draft,
          contextTags: draft.contextTags.includes(action.context)
            ? draft.contextTags.filter((tag) => tag !== action.context)
            : [...draft.contextTags, action.context],
        },
      };
  }
}
export function energyBand(energy: number): EmotionEnergyBand {
  if (energy >= 7) return "high";
  if (energy <= 3) return "low";
  return "neutral";
}
export function suggestEmotions(
  mood: number,
  energy: number,
  emotionOptions: readonly Emotion[],
): Emotion[] {
  let categories: Emotion["category"][];
  if (mood <= 3) categories = ["positive", "neutral", "negative"];
  else if (mood === 4) categories = ["neutral", "positive", "negative"];
  else if (mood <= 6) categories = ["neutral", "negative", "positive"];
  else categories = ["negative", "neutral", "positive"];
  return emotionOptions
    .filter(
      (emotion) => resolveEmotionEnergyBand(emotion) === energyBand(energy),
    )
    .sort(
      (a, b) => categories.indexOf(a.category) - categories.indexOf(b.category),
    )
    .slice(0, MAX_PAD_EMOTIONS);
}
