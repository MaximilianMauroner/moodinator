import { describe, expect, it } from "vitest";
import type { Emotion } from "@db/types";
import {
  EMPTY_MOOD_PAD,
  moodPadPoint,
  moodPadReducer,
  suggestEmotions,
} from "@/components/entry/moodPadDraft";
const choices: Emotion[] = [
  {
    name: "Sad",
    category: "negative",
  },
  {
    name: "Content",
    category: "positive",
  },
  {
    name: "Tired",
    category: "neutral",
  },
  {
    name: "Happy",
    category: "positive",
  },
  {
    name: "Curious",
    category: "neutral",
  },
  {
    name: "Hurt",
    category: "negative",
  },
  {
    name: "Excited",
    category: "positive",
  },
  {
    name: "Surprised",
    category: "neutral",
  },
  {
    name: "Anxious",
    category: "negative",
  },
];
describe("One pad draft", () => {
  it("starts without a selection and keeps details as the touch moves", () => {
    expect(EMPTY_MOOD_PAD.draft).toBeNull();
    let state = moodPadReducer(EMPTY_MOOD_PAD, {
      type: "point",
      mood: 6,
      energy: 1,
    });
    state = moodPadReducer(state, {
      type: "context",
      context: "Home",
    });
    state = moodPadReducer(state, {
      type: "emotions",
      emotions: [choices[0]],
    });
    state = moodPadReducer(state, {
      type: "note",
      note: "A quiet hour",
    });
    state = moodPadReducer(state, {
      type: "point",
      mood: 2,
      energy: 9,
    });
    expect(state.draft).toEqual({
      mood: 2,
      energy: 9,
      contextTags: ["Home"],
      emotions: [choices[0]],
      note: "A quiet hour",
    });
    expect(
      moodPadReducer(state, {
        type: "clear",
      }),
    ).toEqual(EMPTY_MOOD_PAD);
  });
  it("keeps edits when note and More return to the pad without a save", () => {
    let state = moodPadReducer(EMPTY_MOOD_PAD, {
      type: "point",
      mood: 4,
      energy: 5,
    });
    state = moodPadReducer(state, {
      type: "view",
      view: "note",
    });
    state = moodPadReducer(state, {
      type: "note",
      note: "Keep this draft",
    });
    state = moodPadReducer(state, {
      type: "view",
      view: "more",
    });
    state = moodPadReducer(state, {
      type: "context",
      context: "Work",
    });
    state = moodPadReducer(state, {
      type: "view",
      view: "pad",
    });
    expect(state.draft).toMatchObject({
      note: "Keep this draft",
      contextTags: ["Work"],
    });
    expect(
      moodPadReducer(state, {
        type: "context",
        context: "Work",
      }).draft?.contextTags,
    ).toEqual([]);
    expect(
      moodPadReducer(EMPTY_MOOD_PAD, {
        type: "view",
        view: "note",
      }),
    ).toEqual(EMPTY_MOOD_PAD);
  });
  it("lets a user replace one of three emotions and prevents duplicate selections", () => {
    let state = moodPadReducer(EMPTY_MOOD_PAD, {
      type: "point",
      mood: 5,
      energy: 5,
    });
    state = moodPadReducer(state, {
      type: "emotions",
      emotions: choices.slice(0, 4),
    });
    expect(state.draft?.emotions.map((e) => e.name)).toEqual([
      "Sad",
      "Content",
      "Tired",
    ]);
    state = moodPadReducer(state, {
      type: "emotions",
      emotions: [choices[0], choices[0], choices[3], choices[4]],
    });
    expect(state.draft?.emotions.map((e) => e.name)).toEqual([
      "Sad",
      "Happy",
      "Curious",
    ]);
  });
  it("maps every cell centre and the outer edges to the two discrete scales", () => {
    for (let mood = 0; mood <= 10; mood++) {
      for (let energy = 0; energy <= 10; energy++) {
        expect(
          moodPadPoint((mood + 0.5) * 20, (10 - energy + 0.5) * 10, 220, 110),
        ).toEqual({
          mood,
          energy,
        });
      }
    }
    expect(moodPadPoint(-20, -10, 220, 110)).toEqual({
      mood: 0,
      energy: 10,
    });
    expect(moodPadPoint(240, 120, 220, 110)).toEqual({
      mood: 10,
      energy: 0,
    });
  });
});
describe("emotion suggestions", () => {
  it.each([
    [0, ["Content", "Tired", "Sad"]],
    [3, ["Content", "Tired", "Sad"]],
    [4, ["Tired", "Content", "Sad"]],
    [5, ["Tired", "Sad", "Content"]],
    [6, ["Tired", "Sad", "Content"]],
    [7, ["Sad", "Tired", "Content"]],
    [10, ["Sad", "Tired", "Content"]],
  ])(
    "ranks low-energy choices for mood %s on the inverted scale",
    (mood, names) => {
      expect(
        suggestEmotions(mood as number, 1, choices).map(
          (emotion) => emotion.name,
        ),
      ).toEqual(names);
    },
  );
  it.each([
    [0, ["Sad", "Tired", "Content"]],
    [3, ["Sad", "Tired", "Content"]],
    [4, ["Hurt", "Curious", "Happy"]],
    [6, ["Hurt", "Curious", "Happy"]],
    [7, ["Anxious", "Surprised", "Excited"]],
    [10, ["Anxious", "Surprised", "Excited"]],
  ])(
    "uses the touch band at energy %s, including its boundary",
    (energy, names) => {
      expect(
        suggestEmotions(8, energy as number, choices).map(
          (emotion) => emotion.name,
        ),
      ).toEqual(names);
    },
  );
  it("honours configured bands and custom legacy emotions without changing the options", () => {
    const custom: Emotion[] = [
      {
        name: "Happy",
        category: "positive",
        energy: "low",
      },
      {
        name: "My feeling",
        category: "neutral",
      },
    ];
    expect(suggestEmotions(1, 0, custom)).toEqual([custom[0]]);
    expect(suggestEmotions(4, 5, custom)).toEqual([custom[1]]);
    expect(suggestEmotions(1, 9, custom)).toEqual([]);
    expect(custom.map((e) => e.name)).toEqual(["Happy", "My feeling"]);
  });
});
