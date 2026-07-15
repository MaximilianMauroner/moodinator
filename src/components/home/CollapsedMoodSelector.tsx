import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView as RNScrollView,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { HapticTab } from "@/components/HapticTab";
import {
  getAllMoodRatingDisplays,
  getNeutralMoodRating,
} from "@/constants/moodScaleInterpretation";

interface CollapsedMoodSelectorProps {
  isDark: boolean;
  onMoodPress: (mood: number) => void;
  onLongPress: (mood: number) => void;
}

const PILL_WIDTH = 52;
const PILL_HEIGHT = 38;
const PILL_GAP = 5;
const PILL_STEP = PILL_WIDTH + PILL_GAP;
const TRACK_EDGE_INSET = 16;
const CENTER_INDEX = getNeutralMoodRating();
const MIN_VISIBLE_PILLS = 4;
const MAX_VISIBLE_PILLS = 7;
const MOOD_RATING_COUNT = getAllMoodRatingDisplays(false).length;

export function CollapsedMoodSelector({
  isDark,
  onMoodPress,
  onLongPress,
}: CollapsedMoodSelectorProps) {
  const scrollRef = useRef<RNScrollView>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const moodData = useMemo(() => getAllMoodRatingDisplays(isDark), [isDark]);

  const availableScrollWidth = Math.max(0, trackWidth - TRACK_EDGE_INSET * 2);
  const visiblePills =
    availableScrollWidth > 0
      ? Math.max(
          MIN_VISIBLE_PILLS,
          Math.min(
            MAX_VISIBLE_PILLS,
            Math.floor((availableScrollWidth + PILL_GAP) / PILL_STEP)
          )
        )
      : MIN_VISIBLE_PILLS;
  const scrollAreaWidth = visiblePills * PILL_STEP - PILL_GAP;
  const fits = scrollAreaWidth >= MOOD_RATING_COUNT * PILL_STEP - PILL_GAP;

  useEffect(() => {
    if (trackWidth <= 0 || fits) return;

    const leftmostIndex = Math.max(
      0,
      Math.min(
        MOOD_RATING_COUNT - visiblePills,
        CENTER_INDEX - Math.floor(visiblePills / 2)
      )
    );
    const x = leftmostIndex * PILL_STEP;

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x, y: 0, animated: false });
    });
  }, [trackWidth, fits, visiblePills]);

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)}
      style={{
        backgroundColor: isDark ? "#14251C" : "#FDFCFA",
        borderWidth: 1,
        borderColor: isDark ? "#2F513B" : "#E5D9BF",
        borderRadius: 18,
        shadowColor: isDark ? "#09130E" : "#9D8660",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.22 : 0.08,
        shadowRadius: 8,
        elevation: 3,
        overflow: "hidden",
        paddingHorizontal: TRACK_EDGE_INSET,
        paddingVertical: 6,
      }}
    >
      <RNScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={fits ? undefined : PILL_STEP}
        snapToAlignment="start"
        disableIntervalMomentum
        removeClippedSubviews
        style={{
          width: "100%",
          flexGrow: 0,
          flexShrink: 0,
          overflow: "hidden",
        }}
        contentContainerStyle={{
          flexGrow: fits ? 1 : undefined,
          justifyContent: fits ? "center" : "flex-start",
          alignItems: "center",
          gap: PILL_GAP,
        }}
      >
        {moodData.map((mood) => (
          <HapticTab
            key={mood.value}
            className="items-center justify-center"
            style={{
              width: PILL_WIDTH,
              height: PILL_HEIGHT,
              backgroundColor: mood.backgroundHex,
              borderRadius: 12,
            }}
            onPress={() => onMoodPress(mood.value)}
            onLongPress={() => onLongPress(mood.value)}
            delayLongPress={500}
            accessibilityRole="button"
            accessibilityLabel={mood.accessibilityText}
          >
            <Text
              style={{
                color: mood.colorHex,
                fontSize: 14,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
                letterSpacing: 0,
              }}
            >
              {mood.value}
            </Text>
          </HapticTab>
        ))}
      </RNScrollView>
    </View>
  );
}
