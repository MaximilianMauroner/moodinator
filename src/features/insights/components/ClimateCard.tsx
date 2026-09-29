import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { useThemeColors } from "@/constants/colors";
import { getMoodRatingLabel } from "@/constants/moodScaleInterpretation";
import {
  getMoodWeatherColor,
  getMoodWeatherGroup,
  getMoodWeatherIcon,
  type MoodWeatherGroup,
} from "@/constants/moodWeather";
import { typography } from "@/constants/typography";
import type { DaypartMean } from "../utils/rhythm";

const GROUP_WORDS: Record<MoodWeatherGroup, string> = {
  clear: "clear",
  cloudy: "cloudy",
  rain: "rainy",
};

type ClimateCardProps = {
  averageMood: number;
  dayparts: DaypartMean[];
};

/** The range read as a climate: the usual weather, then weather by time of day. */
export function ClimateCard({ averageMood, dayparts }: ClimateCardProps) {
  const { get, isDark } = useThemeColors();
  const level = Math.round(averageMood);
  const summary = `Mostly ${GROUP_WORDS[getMoodWeatherGroup(level)]}, ${getMoodRatingLabel(level)} ${level}`;

  return (
    <SurfaceCard tone="sage" style={{ marginBottom: 12 }}>
      <Text style={[typography.eyebrow, { color: get("textSubtle") }]}>Your climate</Text>
      <View className="mt-2 flex-row items-center" style={{ gap: 12 }}>
        <Ionicons name={getMoodWeatherIcon(level)} size={40} color={getMoodWeatherColor(level, isDark)} />
        <Text style={[typography.titleMd, { flex: 1, color: get("text"), fontSize: 20, lineHeight: 26 }]}>
          {summary}
        </Text>
      </View>
      <View className="mt-4 flex-row" accessible accessibilityLabel={dayparts
        .map((part) => part.mean === null
          ? `${part.daypart}: no entries`
          : `${part.daypart}: ${getMoodRatingLabel(part.mean)} ${Math.round(part.mean)}`)
        .join(", ")}
      >
        {dayparts.map((part) => {
          const partLevel = part.mean === null ? null : Math.round(part.mean);
          return (
            <View key={part.daypart} className="flex-1 items-center" style={{ gap: 3 }}>
              {partLevel === null ? (
                <Text style={{ color: get("textSubtle"), height: 28, lineHeight: 28 }}>–</Text>
              ) : (
                <Ionicons name={getMoodWeatherIcon(partLevel)} size={28} color={getMoodWeatherColor(partLevel, isDark)} />
              )}
              <Text style={[typography.bodySm, { color: get("text"), fontWeight: "600" }]}>{part.daypart}</Text>
              <Text style={[typography.bodySm, { color: get("textSubtle") }]}>
                {partLevel === null ? "No entries" : `${getMoodRatingLabel(partLevel)} ${partLevel}`}
              </Text>
            </View>
          );
        })}
      </View>
    </SurfaceCard>
  );
}
