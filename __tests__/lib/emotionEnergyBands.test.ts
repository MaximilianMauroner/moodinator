import { describe, expect, test } from "vitest";
import {
  DEFAULT_EMOTIONS,
  EMOTION_ENERGY_BAND_LABELS,
  EMOTION_ENERGY_BAND_ORDER,
  getEmotionEnergyBand,
  resolveEmotionEnergyBand,
} from "../../src/lib/entrySettings";

describe("getEmotionEnergyBand", () => {
  test("rates every default emotion", () => {
    const unrated = DEFAULT_EMOTIONS.filter(
      (emotion) => getEmotionEnergyBand(emotion.name) === null
    );
    expect(unrated).toEqual([]);
  });

  test("only returns bands the picker knows how to render", () => {
    const bands = new Set(
      DEFAULT_EMOTIONS.map((emotion) => getEmotionEnergyBand(emotion.name))
    );
    for (const band of bands) {
      expect(EMOTION_ENERGY_BAND_ORDER).toContain(band);
    }
  });

  test("fills every band, so no group renders empty for a default list", () => {
    for (const band of EMOTION_ENERGY_BAND_ORDER) {
      const members = DEFAULT_EMOTIONS.filter(
        (emotion) => getEmotionEnergyBand(emotion.name) === band
      );
      expect(members.length).toBeGreaterThan(0);
    }
  });

  test("places emotions by activation, not by valence", () => {
    // High and low arousal both span positive and negative words.
    expect(getEmotionEnergyBand("Excited")).toBe("high");
    expect(getEmotionEnergyBand("Angry")).toBe("high");
    expect(getEmotionEnergyBand("Relaxed")).toBe("low");
    expect(getEmotionEnergyBand("Sad")).toBe("low");
    expect(getEmotionEnergyBand("Happy")).toBe("neutral");
  });

  test("ignores case and surrounding space", () => {
    expect(getEmotionEnergyBand("  tIrEd  ")).toBe("low");
  });

  test("returns null for custom emotions rather than guessing", () => {
    expect(getEmotionEnergyBand("Dissatisfied")).toBeNull();
    expect(getEmotionEnergyBand("")).toBeNull();
  });

  test("resolves configured and missing custom energy values", () => {
    expect(
      resolveEmotionEnergyBand({ name: "Dissatisfied", category: "neutral" })
    ).toBe("neutral");
    expect(
      resolveEmotionEnergyBand({
        name: "Dissatisfied",
        category: "neutral",
        energy: "high",
      })
    ).toBe("high");
  });

  test("labels every band in render order", () => {
    for (const band of EMOTION_ENERGY_BAND_ORDER) {
      expect(EMOTION_ENERGY_BAND_LABELS[band]).toBeTruthy();
    }
  });
});
