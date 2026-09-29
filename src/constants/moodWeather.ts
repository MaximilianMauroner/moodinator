import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

import { colors } from "./colors";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type MoodWeatherGroup = "clear" | "cloudy" | "rain";

/** Weather sign per mood level: 0 (Elated) is full sun, 10 (Emergency) is a storm. */
const MOOD_WEATHER_ICONS: readonly IoniconName[] = [
  "sunny",
  "sunny-outline",
  "partly-sunny-outline",
  "partly-sunny",
  "cloud-outline",
  "cloudy-outline",
  "cloudy",
  "rainy-outline",
  "rainy",
  "thunderstorm-outline",
  "thunderstorm",
];

/** Picker rows: clear (0 to 3), cloudy (4 to 6), and rain (7 to 10). */
export const MOOD_WEATHER_ROWS: readonly (readonly number[])[] = [
  [0, 1, 2, 3],
  [4, 5, 6],
  [7, 8, 9, 10],
];

const GROUPS: readonly MoodWeatherGroup[] = ["clear", "cloudy", "rain"];

function toLevel(level: number): number {
  return Math.max(0, Math.min(10, Math.round(level)));
}

export function getMoodWeatherIcon(level: number): IoniconName {
  return MOOD_WEATHER_ICONS[toLevel(level)];
}

export function getMoodWeatherColor(level: number, isDark: boolean): string {
  return colors.moodWeather[isDark ? "dark" : "light"][toLevel(level)];
}

export function getMoodWeatherGroup(level: number): MoodWeatherGroup {
  const value = toLevel(level);
  return GROUPS[MOOD_WEATHER_ROWS.findIndex((row) => row.includes(value))];
}
