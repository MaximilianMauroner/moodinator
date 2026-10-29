import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { HapticTab } from "@/components/HapticTab";
import { getMoodButtonHint, getMoodButtonLabel } from "@/constants/accessibility";
import { useThemeColors } from "@/constants/colors";
import { getMoodRatingDisplay } from "@/constants/moodScaleInterpretation";
import { MOOD_WEATHER_ROWS, getMoodWeatherColor, getMoodWeatherIcon } from "@/constants/moodWeather";

const WEATHER_LEVELS = MOOD_WEATHER_ROWS.flat();
const DOCK_WEATHER_ROWS = Array.from(
  { length: Math.ceil(WEATHER_LEVELS.length / 3) },
  (_, index) => WEATHER_LEVELS.slice(index * 3, index * 3 + 3),
);

const SIZES = {
  /** Inside the entry form, where a tap only selects the level. */
  form: { minHeight: 68, icon: 24, number: 17, label: 11, inset: 2, minLabelScale: 0.75 },
  /** Docked on Today, where a tap keeps the entry. */
  dock: { minHeight: 80, icon: 30, number: 18, label: 12, inset: 6, minLabelScale: 0.8 },
};

type WeatherMoodGridProps = {
  /** The selected level; the Today dock has none. */
  selected?: number;
  onPress: (mood: number) => void;
  /** Today only: opens the full entry form for this level. */
  onLongPress?: (mood: number) => void;
  size?: keyof typeof SIZES;
};

export function WeatherMoodGrid({ selected, onPress, onLongPress, size = "form" }: WeatherMoodGridProps) {
  const { isDark, get } = useThemeColors();
  const dims = SIZES[size];
  const isDock = size === "dock";
  const rows = isDock ? DOCK_WEATHER_ROWS : MOOD_WEATHER_ROWS;

  return (
    <View style={{ gap: 8 }}>
      {rows.map((row) => (
        <View key={row[0]} style={{ flexDirection: "row", justifyContent: "center" }}>
          {row.map((level) => {
            const display = getMoodRatingDisplay(level, isDark);
            const isSelected = level === selected;
            const weatherIcon = (
              <Ionicons
                name={getMoodWeatherIcon(level)}
                size={dims.icon}
                color={getMoodWeatherColor(level, isDark)}
              />
            );
            const levelNumber = (
              <Text
                style={{
                  marginTop: isDock ? 0 : 2,
                  marginLeft: isDock ? 6 : 0,
                  fontSize: dims.number,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                  color: get("text"),
                }}
                maxFontSizeMultiplier={1.5}
              >
                {level}
              </Text>
            );
            return (
              <HapticTab
                key={level}
                onPress={() => onPress(level)}
                onLongPress={onLongPress ? () => onLongPress(level) : undefined}
                delayLongPress={500}
                style={{
                  width: isDock ? "31.5%" : "23.5%",
                  marginHorizontal: "0.75%",
                  minHeight: dims.minHeight,
                  paddingVertical: 8,
                  paddingHorizontal: dims.inset,
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
                {isDock ? (
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                    {weatherIcon}
                    {levelNumber}
                  </View>
                ) : (
                  <>
                    {weatherIcon}
                    {levelNumber}
                  </>
                )}
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={dims.minLabelScale}
                  maxFontSizeMultiplier={1.5}
                  style={{ fontSize: dims.label, fontWeight: "500", color: get("textSubtle"), alignSelf: "stretch", textAlign: "center" }}
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
