import {
  clampMoodRating,
  compareMoodRatings,
  getAllMoodRatingDisplays,
  getCurrentMoodScaleSnapshot,
  getMoodRatingDisplay,
  getMoodTrendDirection,
  getInterpretedMoodRating,
  getNeutralMoodRating,
  normalizeMoodRating,
  isBetterMoodRating,
  sortMoodRatingsBestFirst,
} from "../../src/constants/moodScaleInterpretation";
import {
  MOOD_ACCESSIBILITY_LABELS,
  getMoodButtonLabel,
} from "../../src/constants/accessibility";

describe("Mood Scale interpretation", () => {
  it("keeps the current Mood Scale snapshot explicit", () => {
    expect(getCurrentMoodScaleSnapshot()).toEqual({
      version: 1,
      min: 0,
      max: 10,
      lowerIsBetter: true,
    });
  });

  it("treats lower Mood Ratings as better", () => {
    expect(isBetterMoodRating(0, 10)).toBe(true);
    expect(compareMoodRatings(0, 10)).toBeGreaterThan(0);
    expect(compareMoodRatings(10, 0)).toBeLessThan(0);
  });

  it("normalizes Mood Ratings before display", () => {
    expect(clampMoodRating(-1)).toBe(0);
    expect(clampMoodRating(11)).toBe(10);
    expect(getMoodRatingDisplay(10).label).toBe("Emergency");
  });

  it("normalizes stored scale references into the current inverted scale", () => {
    const higherIsBetterScale = {
      version: 2,
      min: 0,
      max: 10,
      lowerIsBetter: false,
    };

    expect(normalizeMoodRating(9, higherIsBetterScale)).toBe(1);
    expect(getMoodRatingDisplay(9, false, higherIsBetterScale).label).toBe(
      "Very Happy"
    );
    expect(
      getInterpretedMoodRating({
        mood: 9,
        moodScale: higherIsBetterScale,
      })
    ).toBe(1);
  });

  it("returns display interpretation with resolved hex colors and accessibility text", () => {
    expect(getMoodRatingDisplay(0)).toMatchObject({
      roundedValue: 0,
      label: "Elated",
      colorHex: "#476D47",
    });
    expect(getMoodRatingDisplay(10).accessibilityText).toContain(
      "Mood Rating 10 of 10: Emergency"
    );
    expect(getMoodRatingDisplay(4.6)).toMatchObject({
      roundedValue: getNeutralMoodRating(),
      label: "Neutral",
    });
  });

  it("provides all Mood Rating displays without callers reading scale constants", () => {
    const displays = getAllMoodRatingDisplays();

    expect(displays).toHaveLength(11);
    expect(displays[0]).toMatchObject({ roundedValue: 0, label: "Elated" });
    expect(displays[10]).toMatchObject({ roundedValue: 10, label: "Emergency" });
  });

  it("describes the inverted Mood Scale in accessibility labels", () => {
    expect(MOOD_ACCESSIBILITY_LABELS[0]).toContain("best possible");
    expect(MOOD_ACCESSIBILITY_LABELS[10]).toContain("needs immediate support");
    expect(getMoodButtonLabel(10, "Emergency")).toContain("Lower numbers are better");
  });

  it("sorts semantic Mood Rating averages best first", () => {
    expect([8, 2, 5].sort(sortMoodRatingsBestFirst)).toEqual([2, 5, 8]);
  });

  it("preserves sub-integer precision when comparing averaged ratings", () => {
    // Averages within the same rounded bucket must still compare distinctly,
    // otherwise the "best/worst day" selection collapses to a tie.
    expect(isBetterMoodRating(3.1, 3.4)).toBe(true);
    expect(isBetterMoodRating(3.4, 3.1)).toBe(false);
    expect([3.4, 3.1, 3.25].sort(sortMoodRatingsBestFirst)).toEqual([
      3.1, 3.25, 3.4,
    ]);
  });

  it("maps trend deltas through the inverted Mood Scale", () => {
    expect(getMoodTrendDirection(-0.4)).toBe("down");
    expect(getMoodTrendDirection(0.4)).toBe("up");
    expect(getMoodTrendDirection(0.05)).toBe("stable");
  });
});
