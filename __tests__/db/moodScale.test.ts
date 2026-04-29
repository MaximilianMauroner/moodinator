import {
  clampMoodRating,
  compareMoodRatings,
  getCurrentMoodScaleSnapshot,
  getMoodRatingDisplay,
  isBetterMoodRating,
} from "../../src/constants/moodScaleInterpretation";

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
});
