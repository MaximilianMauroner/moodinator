import React from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useThemeColors } from "@/constants/colors";
import { getInterpretedMoodRating, getMoodRatingLabel } from "@/constants/moodScaleInterpretation";
import { getMoodWeatherColor, getMoodWeatherIcon } from "@/constants/moodWeather";
import { typography } from "@/constants/typography";
import type { ForecastDay } from "./forecast";

type ForecastCardProps = {
  days: ForecastDay[];
  /** True once the range has loaded; exposes a marker for native QA. */
  ready: boolean;
  onSelectDay: (day: ForecastDay) => void;
};

function dayName(day: ForecastDay, index: number): string {
  if (index === 0) return "Today";
  return day.date.toLocaleDateString([], { weekday: "short" });
}

function dayLabel(day: ForecastDay): string {
  const date = day.date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  if (day.lightest === null || day.heaviest === null || day.average === null) {
    return `${date}, no entries`;
  }
  const count = `${day.entries.length} ${day.entries.length === 1 ? "entry" : "entries"}`;
  return `${date}, ${count}, from ${getMoodRatingLabel(day.lightest)} ${day.lightest} to ${getMoodRatingLabel(day.heaviest)} ${day.heaviest}, average ${getMoodRatingLabel(day.average)}`;
}

/** A week read like a weather forecast: one row per day with its range. */
export function ForecastCard({ days, ready, onSelectDay }: ForecastCardProps) {
  const { get, isDark } = useThemeColors();
  const { fontScale } = useWindowDimensions();
  const labelWidth = 50 * Math.max(1, fontScale);
  const endpointWidth = 24 * Math.max(1, fontScale);

  return (
    <View
      testID={ready ? "forecast-ready" : undefined}
      className="rounded-3xl px-4 pb-1 pt-3"
      style={{ backgroundColor: get("surface"), borderWidth: 1, borderColor: get("borderSubtle") }}
    >
      <View className="mb-1 flex-row flex-wrap justify-between gap-x-3 gap-y-1">
        <Text style={[typography.bodySm, { color: get("text"), fontWeight: "600" }]}>Last 7 days</Text>
        <Text style={[typography.bodySm, { color: get("textSubtle") }]}>0 lighter · 10 heavier</Text>
      </View>
      {days.map((day, index) => {
        const average = day.average === null ? null : Math.round(day.average);
        return (
          <Pressable
            key={day.dayKey}
            onPress={() => onSelectDay(day)}
            className="flex-row flex-wrap items-center active:opacity-70"
            style={{ minHeight: 48, paddingVertical: 8, borderTopWidth: 1, borderTopColor: get("borderSubtle"), gap: 10 }}
            accessibilityRole="button"
            accessibilityLabel={dayLabel(day)}
            accessibilityHint="Opens the entries of this day"
            testID={`forecast-day-${day.dayKey}`}
          >
            <View className="flex-row flex-wrap items-center gap-2.5">
              <Text style={[typography.bodyMd, { width: labelWidth, color: get("text") }]}>{dayName(day, index)}</Text>
              <View style={{ width: 28, alignItems: "center" }}>
                {average === null ? (
                  <Text style={{ color: get("textSubtle") }}>–</Text>
                ) : (
                  <Ionicons name={getMoodWeatherIcon(average)} size={24} color={getMoodWeatherColor(average, isDark)} />
                )}
              </View>
            </View>
            <View className="flex-row items-center gap-2.5" style={{ flex: 1, minWidth: endpointWidth * 2 + 60 }}>
              <Text style={[typography.bodySm, { width: endpointWidth, textAlign: "center", color: get("textSubtle") }]}>
                {day.lightest ?? ""}
              </Text>
              <View style={{ flex: 1, height: 14, justifyContent: "center" }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: get("surfaceAlt") }} />
                {day.lightest !== null && day.heaviest !== null && average !== null ? (
                  <View
                    style={{
                      position: "absolute",
                      left: `${day.lightest * 10}%`,
                      right: `${100 - day.heaviest * 10}%`,
                      minWidth: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: getMoodWeatherColor(average, isDark),
                    }}
                  />
                ) : null}
                {day.entries.map((entry) => (
                  <View
                    key={entry.id}
                    style={{
                      position: "absolute",
                      left: `${getInterpretedMoodRating(entry) * 10}%`,
                      marginLeft: -2,
                      width: 4,
                      height: 14,
                      borderRadius: 2,
                      backgroundColor: get("text"),
                      opacity: 0.8,
                    }}
                  />
                ))}
              </View>
              <Text style={[typography.bodySm, { width: endpointWidth, textAlign: "center", color: get("textSubtle") }]}>
                {day.heaviest ?? ""}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
