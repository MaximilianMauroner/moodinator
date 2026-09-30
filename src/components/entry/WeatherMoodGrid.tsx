import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { HapticTab } from "@/components/HapticTab";
import { getMoodButtonLabel } from "@/constants/accessibility";
import { useThemeColors } from "@/constants/colors";
import { getMoodRatingDisplay } from "@/constants/moodScaleInterpretation";
import { MOOD_WEATHER_ROWS, getMoodWeatherColor, getMoodWeatherIcon } from "@/constants/moodWeather";

type WeatherMoodGridProps = {
  value: number;
  onChange: (mood: number) => void;
};

/**
 * The 4/3/4 weather picker for choosing a mood inside a form. Unlike the
 * Today picker, a tap only selects the level. Tiles grow with the text size.
 */
export function WeatherMoodGrid({ value, onChange }: WeatherMoodGridProps) {
  const { isDark, get } = useThemeColors();

  return (
    <View style={{ gap: 8 }}>
      {MOOD_WEATHER_ROWS.map((row) => (
        <View key={row[0]} style={{ flexDirection: "row", justifyContent: "center" }}>
          {row.map((level) => {
            const display = getMoodRatingDisplay(level, isDark);
            const selected = level === value;
            return (
              <HapticTab
                key={level}
                onPress={() => onChange(level)}
                style={{
                  width: "23.5%",
                  marginHorizontal: "0.75%",
                  minHeight: 68,
                  paddingVertical: 8,
                  paddingHorizontal: 2,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 16,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? get("primary") : get("border"),
                  backgroundColor: selected ? get("surfaceElevated") : get("background"),
                }}
                accessibilityRole="button"
                accessibilityLabel={getMoodButtonLabel(level, display.label)}
                accessibilityState={{ selected }}
              >
                <Ionicons
                  name={getMoodWeatherIcon(level)}
                  size={24}
                  color={getMoodWeatherColor(level, isDark)}
                />
                <Text
                  style={{
                    marginTop: 2,
                    fontSize: 17,
                    fontWeight: "700",
                    fontVariant: ["tabular-nums"],
                    color: get("text"),
                  }}
                >
                  {level}
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  style={{ fontSize: 11, fontWeight: "500", color: get("textSubtle"), alignSelf: "stretch", textAlign: "center" }}
                >
                  {display.label}
                </Text>
              </HapticTab>
            );
          })}
        </View>
      ))}
    </View>
  );
}
