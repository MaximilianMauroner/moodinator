import React, { useRef, useState } from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  getMoodButtonLabel,
  getEnergyLevelLabel,
} from "@/constants/accessibility";
import { useThemeColors } from "@/constants/colors";
import { getMoodRatingLabel } from "@/constants/moodScaleInterpretation";
import { getMoodWeatherColor } from "@/constants/moodWeather";
import { typography } from "@/constants/typography";
import { haptics } from "@/lib/haptics";
import { moodPadPoint, type MoodPadDraft } from "./moodPadDraft";
type Props = {
  draft: MoodPadDraft | null;
  onChange: (mood: number, energy: number) => void;
};
const LEVELS = Array.from(
  {
    length: 11,
  },
  (_, index) => index,
);
export function MoodPad({ draft, onChange }: Props) {
  const { isDark, get } = useThemeColors();
  const [size, setSize] = useState({
    width: 1,
    height: 1,
  });
  const lastCell = useRef<string | null>(null);
  const point = (x: number, y: number) => {
    const cell = moodPadPoint(x, y, size.width, size.height);
    const key = `${cell.mood},${cell.energy}`;
    if (key === lastCell.current) return;
    lastCell.current = key;
    haptics.tick();
    onChange(cell.mood, cell.energy);
  };
  const gesture = Gesture.Pan()
    .minDistance(0)
    .runOnJS(true)
    .onBegin((event) => {
      lastCell.current = null;
      point(event.x, event.y);
    })
    .onUpdate((event) => point(event.x, event.y));
  const mood = draft?.mood ?? 5;
  const energy = draft?.energy ?? 5;
  const caption = [
    typography.bodySm,
    {
      color: get("textMuted"),
    },
  ];
  return (
    <View>
      <GestureDetector gesture={gesture}>
        <View
          testID="mood-pad"
          collapsable={false}
          onLayout={(event) => setSize(event.nativeEvent.layout)}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{
            height: 184,
            borderRadius: 16,
            overflow: "hidden",
            backgroundColor: get("surfaceAlt"),
          }}
        >
          <View className="absolute inset-0 flex-row" pointerEvents="none">
            {LEVELS.map((level) => (
              <View
                key={level}
                style={{
                  flex: 1,
                  backgroundColor: getMoodWeatherColor(level, isDark),
                  opacity: 0.32,
                }}
              >
                {LEVELS.map((row) => (
                  <View
                    key={row}
                    style={{
                      flex: 1,
                      borderRightWidth: 1,
                      borderBottomWidth: 1,
                      borderColor: get("surface"),
                      opacity: 0.55,
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
          <Text
            maxFontSizeMultiplier={1.3}
            style={[
              ...caption,
              {
                position: "absolute",
                top: 6,
                left: 10,
              },
            ]}
          >
            Wired
          </Text>
          <Text
            maxFontSizeMultiplier={1.3}
            style={[
              ...caption,
              {
                position: "absolute",
                bottom: 6,
                left: 10,
              },
            ]}
          >
            Drained
          </Text>
          {draft ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 20,
                height: 20,
                borderRadius: 10,
                left: ((draft.mood + 0.5) / 11) * size.width - 10,
                top: ((10 - draft.energy + 0.5) / 11) * size.height - 10,
                backgroundColor: getMoodWeatherColor(draft.mood, isDark),
                borderWidth: 3,
                borderColor: get("surface"),
                shadowColor: get("text"),
                shadowOffset: {
                  width: 0,
                  height: 1,
                },
                shadowOpacity: 0.25,
                shadowRadius: 3,
                elevation: 3,
              }}
            />
          ) : (
            <View
              pointerEvents="none"
              className="flex-1 items-center justify-center"
            >
              <Text
                maxFontSizeMultiplier={1.3}
                style={[
                  typography.bodyMd,
                  {
                    color: get("text"),
                  },
                ]}
              >
                Touch where you are
              </Text>
            </View>
          )}
        </View>
      </GestureDetector>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 184,
          flexDirection: "row",
        }}
      >
        {(["mood", "energy"] as const).map((axis) => {
          const value = axis === "mood" ? mood : energy;
          return (
            <View
              key={axis}
              testID={`mood-pad-${axis}`}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={
                axis === "mood"
                  ? getMoodButtonLabel(mood, getMoodRatingLabel(mood))
                  : getEnergyLevelLabel(energy, !!draft)
              }
              accessibilityHint="Swipe up or down to adjust. This starts or changes your draft."
              accessibilityValue={{
                min: 0,
                max: 10,
                now: value,
                text: draft ? String(value) : "No selection. Start at 5.",
              }}
              accessibilityActions={[
                {
                  name: "increment",
                },
                {
                  name: "decrement",
                },
              ]}
              onAccessibilityAction={(event) => {
                const next = Math.min(
                  10,
                  Math.max(
                    0,
                    value +
                      (event.nativeEvent.actionName === "increment" ? 1 : -1),
                  ),
                );
                onChange(
                  axis === "mood" ? next : mood,
                  axis === "energy" ? next : energy,
                );
              }}
              style={{
                flex: 1,
                minHeight: 44,
                justifyContent: "center",
              }}
            ></View>
          );
        })}
      </View>
      <View className="flex-row justify-between mt-1">
        <Text maxFontSizeMultiplier={1.3} style={caption}>
          Elated
        </Text>
        <Text maxFontSizeMultiplier={1.3} style={caption}>
          Emergency
        </Text>
      </View>
    </View>
  );
}
