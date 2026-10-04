import { describe, expect, it, vi } from "vitest";
import glyphs from "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json";

import { colors } from "@/constants/colors";
import {
  MOOD_WEATHER_ROWS,
  getMoodWeatherColor,
  getMoodWeatherGroup,
  getMoodWeatherIcon,
} from "@/constants/moodWeather";

// colors.ts imports the React Native color scheme hook; vitest hoists this mock.
vi.mock("@/hooks/useColorScheme", () => ({ useColorScheme: () => "light" }));

function luminance(hex: string): number {
  const [red, green, blue] = (hex.slice(1).match(/.{2}/g) ?? [])
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    );
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const LEVELS = Array.from({ length: 11 }, (_, level) => level);

describe("mood weather", () => {
  it("uses an Ionicons glyph that exists for every level", () => {
    for (const level of LEVELS) {
      expect(glyphs, `level ${level}`).toHaveProperty(getMoodWeatherIcon(level));
    }
  });

  it("places every level in exactly one picker row, in order", () => {
    expect(MOOD_WEATHER_ROWS.flat()).toEqual(LEVELS);
    expect(MOOD_WEATHER_ROWS.map((row) => row.length)).toEqual([4, 3, 4]);
    expect(LEVELS.map(getMoodWeatherGroup)).toEqual([
      "clear", "clear", "clear", "clear",
      "cloudy", "cloudy", "cloudy",
      "rain", "rain", "rain", "rain",
    ]);
  });

  it("keeps each weather sign at 3:1 contrast against the background", () => {
    for (const level of LEVELS) {
      expect(contrast(getMoodWeatherColor(level, false), colors.background.light), `light ${level}`).toBeGreaterThanOrEqual(3);
      expect(contrast(getMoodWeatherColor(level, true), colors.background.dark), `dark ${level}`).toBeGreaterThanOrEqual(3);
    }
  });
});
