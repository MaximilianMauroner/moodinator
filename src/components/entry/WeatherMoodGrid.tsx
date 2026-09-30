import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { HapticTab } from "@/components/HapticTab";
import { getMoodButtonHint, getMoodButtonLabel } from "@/constants/accessibility";
import { useThemeColors } from "@/constants/colors";
import { getMoodRatingDisplay } from "@/constants/moodScaleInterpretation";
import { MOOD_WEATHER_ROWS, getMoodWeatherColor, getMoodWeatherIcon } from "@/constants/moodWeather";

const SIZES = {
  /** Inside the entry form, where a tap only selects the level. */
  form: { minHeight: 68, icon: 24, number: 17 },
  /** Docked on Today, where a tap keeps the entry. */
  dock: { minHeight: 80, icon: 30, number: 18 },
};

type WeatherMoodGridProps = {
  /** The selected level; the Today dock has none. */
  selected?: number;
  onPress: (mood: number) => void;
  /** Today only: opens the full entry form for this level. */
  onLongPress?: (mood: number) => void;
  size?: keyof typeof SIZES;
};

/**
 * The 4/3/4 weather picker: clear (0 to 3), cloudy (4 to 6), and rain (7 to
 * 10), with the middle row centered. Tiles grow with the system text size.
 */
export function WeatherMoodGrid({ selected, onPress, onLongPress, size = "form" }: WeatherMoodGridProps) {
  const { isDark, get } = useThemeColors();
  const dims = SIZES[size];

  return (
    <View style={{ gap: 8 }}>
      {MOOD_WEATHER_ROWS.map((row) => (
        <View key={row[0]} style={{ flexDirection: "row", justifyContent: "center" }}>
          {row.map((level) => {
            const display = getMoodRatingDisplay(level, isDark);
            const isSelected = level === selected;
            return (
              <HapticTab
                key={level}
                onPress={() => onPress(level)}
                onLongPress={onLongPress ? () => onLongPress(level) : undefined}
                delayLongPress={500}
                style={{
                  width: "23.5%",
                  marginHorizontal: "0.75%",
                  minHeight: dims.minHeight,
                  paddingVertical: 8,
                  paddingHorizontal: 2,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 16,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? get("primary") : get("border"),
                  backgroundColor: isSelected ? get("surfaceElevated") : get("background"),
                }}
                accessibilityRole="button"
                accessibilityLabel={getMoodButtonLabel(level, display.label)}
                accessibilityHint={onLongPress ? getMoodButtonHint() : undefined}
                accessibilityState={selected === undefined ? undefined : { selected: isSelected }}
              >
                <Ionicons
                  name={getMoodWeatherIcon(level)}
                  size={dims.icon}
                  color={getMoodWeatherColor(level, isDark)}
                />
                <Text
                  style={{
                    marginTop: 2,
                    fontSize: dims.number,
                    fontWeight: "700",
                    fontVariant: ["tabular-nums"],
                    color: get("text"),
                  }}
                  maxFontSizeMultiplier={1.5}
                >
                  {level}
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  maxFontSizeMultiplier={1.5}
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
