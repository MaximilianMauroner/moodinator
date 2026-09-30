import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { HapticTab } from "@/components/HapticTab";
import {
  getAllMoodRatingDisplays,
  type MoodRatingDisplay,
} from "@/constants/moodScaleInterpretation";
import { useThemeColors, colors } from "@/constants/colors";
import { getMoodButtonLabel, getMoodButtonHint } from "@/constants/accessibility";
import { getMoodWeatherColor, getMoodWeatherIcon } from "@/constants/moodWeather";

// ─── Layout constants ──────────────────────────────────────────────────────────

// Expanded weather grid: rows of 4, 3, and 4 (clear, cloudy, rain). The middle
// row is centered and uses the same tile width as the outer rows.
const EXPANDED_HEADER_HEIGHT = 36; // divider row + spacing below
const EXPANDED_ROW_GAP = 8;
const EXPANDED_H_MARGIN = 4; // mx-1 each side
const EXPANDED_ICON_SIZE = 24;
const NUMBER_LINE_HEIGHT = 20;
const LABEL_LINE_HEIGHT = 15;
/** Tile text grows with the system font size up to this factor. */
const MAX_TILE_FONT_SCALE = 1.5;

function getTileFontScale(fontScale: number) {
  return Math.min(Math.max(fontScale, 1), MAX_TILE_FONT_SCALE);
}

/** Tile height that fits the icon, number, and label at this font scale. */
function getExpandedRowHeight(fontScale: number) {
  const scale = getTileFontScale(fontScale);
  const content = EXPANDED_ICON_SIZE + 2 + (NUMBER_LINE_HEIGHT + 2 + LABEL_LINE_HEIGHT) * scale;
  return Math.ceil(content + 8);
}

/** Total height of this component when fully expanded, at this font scale. */
export function getUnifiedExpandedHeight(fontScale: number) {
  return EXPANDED_HEADER_HEIGHT + 3 * getExpandedRowHeight(fontScale) + 2 * EXPANDED_ROW_GAP + 8;
}

// Collapsed pill row (must match constants in index.tsx)
const COLLAPSED_HEIGHT = 60;
const PILL_W = 52;
const PILL_H = 38;
const PILL_GAP = 5;
const TRACK_PAD_X = 16;
const MOOD_RATING_COUNT = getAllMoodRatingDisplays(false).length;
const COLLAPSED_TRACK_CONTENT_WIDTH =
  TRACK_PAD_X * 2 + MOOD_RATING_COUNT * PILL_W + (MOOD_RATING_COUNT - 1) * PILL_GAP;

// ─── Position helpers (worklet-safe) ──────────────────────────────────────────

function collapsedPos(index: number) {
  "worklet";
  return {
    left: TRACK_PAD_X + index * (PILL_W + PILL_GAP),
    top: (COLLAPSED_HEIGHT - PILL_H) / 2,
    width: PILL_W,
    height: PILL_H,
    borderRadius: 12,
  };
}

function expandedPos(index: number, containerWidth: number, rowHeight: number) {
  "worklet";
  // Matches MOOD_WEATHER_ROWS: 0-3, 4-6 (centered), 7-10.
  const row = index < 4 ? 0 : index < 7 ? 1 : 2;
  const col = row === 0 ? index : row === 1 ? index - 4 : index - 7;
  const slot = containerWidth / 4;
  const btnW = slot - EXPANDED_H_MARGIN * 2;
  const rowOffset = row === 1 ? slot / 2 : 0;
  return {
    left: rowOffset + col * slot + EXPANDED_H_MARGIN,
    top:
      EXPANDED_HEADER_HEIGHT + row * (rowHeight + EXPANDED_ROW_GAP),
    width: btnW,
    height: rowHeight,
    borderRadius: 16,
  };
}

// ─── Individual button ─────────────────────────────────────────────────────────

interface MoodButtonProps {
  mood: MoodRatingDisplay;
  index: number;
  collapseProgress: SharedValue<number>;
  expandedWidth: number;
  fontScale: number;
  isDark: boolean;
  onMoodPress: (mood: number) => void;
  onLongPress: (mood: number) => void;
}

function MoodButton({
  mood,
  index,
  collapseProgress,
  expandedWidth,
  fontScale,
  isDark,
  onMoodPress,
  onLongPress,
}: MoodButtonProps) {
  const rowHeight = getExpandedRowHeight(fontScale);
  const labelHeight = Math.ceil(LABEL_LINE_HEIGHT * getTileFontScale(fontScale));
  const { get } = useThemeColors();
  const tileBg = get("background");
  const tileBorder = get("border");
  const numberInk = get("text");
  const containerStyle = useAnimatedStyle(() => {
    const p = collapseProgress.value;
    const c = collapsedPos(index);
    const e = expandedPos(index, expandedWidth, rowHeight);
    return {
      position: "absolute" as const,
      left: interpolate(p, [0, 1], [e.left, c.left], Extrapolation.CLAMP),
      top: interpolate(p, [0, 1], [e.top, c.top], Extrapolation.CLAMP),
      width: interpolate(p, [0, 1], [e.width, c.width], Extrapolation.CLAMP),
      height: interpolate(
        p,
        [0, 1],
        [e.height, c.height],
        Extrapolation.CLAMP
      ),
      borderRadius: interpolate(
        p,
        [0, 1],
        [e.borderRadius, c.borderRadius],
        Extrapolation.CLAMP
      ),
      overflow: "hidden" as const,
      // Expanded tiles are outlined; the collapsed pill takes the mood tint.
      backgroundColor: interpolateColor(p, [0, 1], [tileBg, mood.backgroundHex]),
      borderWidth: 1,
      borderColor: interpolateColor(p, [0, 1], [tileBorder, mood.backgroundHex]),
    };
  });

  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      collapseProgress.value,
      [0, 0.3],
      [1, 0],
      Extrapolation.CLAMP
    ),
    height: interpolate(
      collapseProgress.value,
      [0, 0.45],
      [EXPANDED_ICON_SIZE + 2, 0],
      Extrapolation.CLAMP
    ),
  }));

  const numberStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      collapseProgress.value,
      [0, 1],
      [numberInk, mood.colorHex]
    ),
    fontSize: interpolate(
      collapseProgress.value,
      [0, 1],
      [17, 14],
      Extrapolation.CLAMP
    ),
    marginBottom: interpolate(
      collapseProgress.value,
      [0, 0.5],
      [2, 0],
      Extrapolation.CLAMP
    ),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      collapseProgress.value,
      [0, 0.3],
      [1, 0],
      Extrapolation.CLAMP
    ),
    height: interpolate(
      collapseProgress.value,
      [0, 0.45],
      [labelHeight, 0],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <Animated.View style={containerStyle}>
      <HapticTab
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
        onPress={() => onMoodPress(mood.value)}
        onLongPress={() => onLongPress(mood.value)}
        delayLongPress={500}
        accessibilityRole="button"
        accessibilityLabel={getMoodButtonLabel(mood.value, mood.label)}
        accessibilityHint={getMoodButtonHint()}
      >
        <Animated.View style={[{ overflow: "hidden" }, iconStyle]}>
          <Ionicons
            name={getMoodWeatherIcon(mood.value)}
            size={EXPANDED_ICON_SIZE}
            color={getMoodWeatherColor(mood.value, isDark)}
          />
        </Animated.View>
        <Animated.Text
          style={[
            {
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
              lineHeight: NUMBER_LINE_HEIGHT,
              alignSelf: "stretch",
              textAlign: "center",
            },
            numberStyle,
          ]}
          maxFontSizeMultiplier={MAX_TILE_FONT_SCALE}
        >
          {mood.value}
        </Animated.Text>
        <Animated.Text
          style={[
            {
              color: get("textSubtle"),
              fontSize: 11,
              fontWeight: "500",
              lineHeight: LABEL_LINE_HEIGHT,
              textAlign: "center",
              alignSelf: "stretch",
              paddingHorizontal: 2,
            },
            labelStyle,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          maxFontSizeMultiplier={MAX_TILE_FONT_SCALE}
        >
          {mood.label}
        </Animated.Text>
      </HapticTab>
    </Animated.View>
  );
}

// ─── Container ─────────────────────────────────────────────────────────────────

interface UnifiedMoodSelectorProps {
  collapseProgress: SharedValue<number>;
  isDark: boolean;
  onMoodPress: (mood: number) => void;
  onLongPress: (mood: number) => void;
}

export function UnifiedMoodSelector({
  collapseProgress,
  isDark,
  onMoodPress,
  onLongPress,
}: UnifiedMoodSelectorProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const { get } = useThemeColors();
  const { fontScale } = useWindowDimensions();

  const trackBgColor = isDark ? colors.surface.dark : colors.surface.light;
  const trackBorderColor = isDark ? colors.border.dark : colors.border.light;
  const textMutedColor = isDark ? colors.sand.textMuted.dark : colors.textMuted.light;
  const moodData = React.useMemo(
    () => getAllMoodRatingDisplays(isDark),
    [isDark]
  );

  // Track background fades in as the panel collapses
  const trackBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      collapseProgress.value,
      [0.55, 1],
      [0, 1],
      Extrapolation.CLAMP
    ),
    borderRadius: interpolate(
      collapseProgress.value,
      [0, 1],
      [28, 18],
      Extrapolation.CLAMP
    ),
  }));

  // "How are you feeling?" header fades out when collapsing
  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      collapseProgress.value,
      [0, 0.25],
      [1, 0],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        translateY: interpolate(
          collapseProgress.value,
          [0, 1],
          [0, -8],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  useAnimatedReaction(
    () => collapseProgress.value >= 0.995,
    (nextIsCollapsed: boolean, prevIsCollapsed: boolean | null) => {
      if (nextIsCollapsed !== prevIsCollapsed) {
        runOnJS(setIsCollapsed)(nextIsCollapsed);
      }
    },
    []
  );

  useEffect(() => {
    if (!isCollapsed) {
      scrollViewRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [isCollapsed]);

  const borderColor = get("border");
  const expandedContentWidth = Math.max(
    0,
    containerWidth - TRACK_PAD_X * 2
  );
  const contentWidth = Math.max(containerWidth, COLLAPSED_TRACK_CONTENT_WIDTH);

  return (
    <View
      style={{ flex: 1, overflow: "hidden" }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* "How are you feeling?" header */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: EXPANDED_HEADER_HEIGHT,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 8,
          },
          headerStyle,
        ]}
        pointerEvents="none"
      >
        <View
          style={{ flex: 1, height: 1, backgroundColor: borderColor }}
        />
        <Text
          style={{
            fontSize: 12,
            fontWeight: "500",
            marginHorizontal: 16,
            letterSpacing: 0.3,
            color: textMutedColor,
          }}
        >
          How are you feeling?
        </Text>
        <View
          style={{ flex: 1, height: 1, backgroundColor: borderColor }}
        />
      </Animated.View>

      {/* Fixed collapsed track frame. The scroll viewport is inset inside this frame. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: trackBgColor,
            borderWidth: 1,
            borderColor: trackBorderColor,
          },
          trackBgStyle,
        ]}
      />

      <ScrollView
        ref={scrollViewRef}
        horizontal
        bounces={false}
        scrollEnabled={isCollapsed}
        showsHorizontalScrollIndicator={false}
        style={[
          StyleSheet.absoluteFill,
          {
            left: TRACK_PAD_X,
            right: TRACK_PAD_X,
          },
        ]}
        contentContainerStyle={{ width: contentWidth }}
      >
        <View style={{ width: contentWidth, flex: 1 }}>
          {/* Mood buttons — each one is an independent entity that travels between states */}
          {containerWidth > 0 &&
            moodData.map((mood, index) => (
              <MoodButton
                key={mood.value}
                mood={mood}
                index={index}
                collapseProgress={collapseProgress}
                expandedWidth={expandedContentWidth}
                fontScale={fontScale}
                isDark={isDark}
                onMoodPress={onMoodPress}
                onLongPress={onLongPress}
              />
            ))}

        </View>
      </ScrollView>

    </View>
  );
}
