import React from "react";
import { Pressable, Text, View } from "react-native";
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

export function ForecastCard({ days, ready, onSelectDay }: ForecastCardProps) {
  const { get, isDark } = useThemeColors();

  return (
    <View
      testID={ready ? "forecast-ready" : undefined}
      className="rounded-3xl px-4 pb-2 pt-3"
      style={{ backgroundColor: get("surface"), borderWidth: 1, borderColor: get("borderSubtle") }}
    >
      <View className="mb-2 gap-1">
        <Text style={[typography.bodySm, { color: get("text"), fontWeight: "600" }]}>Last 7 days</Text>
        <Text style={[typography.bodySm, { color: get("textSubtle") }]}>0 lighter · 10 heavier</Text>
      </View>
      <View className="flex-row flex-wrap justify-center">
        {days.map((day, index) => {
          const average = day.average === null ? null : Math.round(day.average);
          return (
            <Pressable
              key={day.dayKey}
              onPress={() => onSelectDay(day)}
              className="w-1/4 items-center py-2 active:opacity-70"
              style={{ minWidth: 48, minHeight: 48, borderTopWidth: 1, borderTopColor: get("borderSubtle") }}
              accessibilityRole="button"
              accessibilityLabel={dayLabel(day)}
              accessibilityHint="Opens the entries of this day"
              testID={`forecast-day-${day.dayKey}`}
            >
              <Text style={[typography.bodyMd, { color: get("text"), textAlign: "center" }]}>{dayName(day, index)}</Text>
              <View className="w-full flex-row items-center" style={{ gap: 4 }}>
                <View style={{ width: 24, alignItems: "center" }}>
                  {average === null ? (
                    <Text style={{ color: get("textSubtle") }}>–</Text>
                  ) : (
                    <Ionicons name={getMoodWeatherIcon(average)} size={24} color={getMoodWeatherColor(average, isDark)} />
                  )}
                </View>
                <View className="flex-1">
                  <View testID={`forecast-track-${day.dayKey}`} style={{ height: 14, justifyContent: "center" }}>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: get("border") }} />
                    <View style={{ position: "absolute", left: 3, right: 3, top: 0, bottom: 0, justifyContent: "center" }}>
                      {day.lightest !== null && day.heaviest !== null && average !== null ? (
                        <View
                          testID={`forecast-range-${day.dayKey}`}
                          style={{
                            position: "absolute",
                            left: `${day.lightest * 10}%`,
                            right: `${100 - day.heaviest * 10}%`,
                            marginHorizontal: -3,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: getMoodWeatherColor(average, isDark),
                          }}
                        />
                      ) : null}
                      {day.entries.map((entry) => (
                        <View
                          key={entry.id}
                          testID={`forecast-tick-${day.dayKey}-${entry.id}`}
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
                  </View>
                  <View className="flex-row">
                    <Text style={[typography.bodySm, { flex: 1, color: get("textSubtle") }]}>
                      {day.lightest ?? ""}
                    </Text>
                    <Text style={[typography.bodySm, { flex: 1, textAlign: "right", color: get("textSubtle") }]}>
                      {day.heaviest ?? ""}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
