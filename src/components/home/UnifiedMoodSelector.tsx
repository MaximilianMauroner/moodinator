import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { HapticTab } from "@/components/HapticTab";
import { moodScale } from "@/constants/moodScale";
import { useThemeColors, colors } from "@/constants/colors";
import { getMoodButtonLabel, getMoodButtonHint } from "@/constants/accessibility";

// ─── Layout constants ──────────────────────────────────────────────────────────

// Expanded compact grid
const EXPANDED_HEADER_HEIGHT = 36; // divider row + spacing below
const EXPANDED_ROW_HEIGHT = 44;
const EXPANDED_ROW_GAP = 8;
const EXPANDED_H_MARGIN = 4; // mx-1 each side
const EXPANDED_GRADIENT_TOP =
  EXPANDED_HEADER_HEIGHT + 3 * EXPANDED_ROW_HEIGHT + 2 * EXPANDED_ROW_GAP + 8;
const EXPANDED_GRADIENT_HEIGHT = 28; // bar + labels

/** Total height occupied by this component when fully expanded (compact mode). */
export const UNIFIED_COMPACT_EXPANDED_HEIGHT =
  EXPANDED_GRADIENT_TOP + EXPANDED_GRADIENT_HEIGHT;

// Collapsed pill row (must match constants in index.tsx)
const COLLAPSED_HEIGHT = 60;
const PILL_W = 52;
const PILL_H = 38;
const PILL_GAP = 5;
const TRACK_PAD_X = 8;
const COLLAPSED_TRACK_CONTENT_WIDTH =
  TRACK_PAD_X * 2 + moodScale.length * PILL_W + (moodScale.length - 1) * PILL_GAP;

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

function expandedPos(index: number, containerWidth: number) {
  "worklet";
  const colCount = index < 8 ? 4 : 3;
  const col = index < 4 ? index : index < 8 ? index - 4 : index - 8;
  const row = index < 4 ? 0 : index < 8 ? 1 : 2;
  const btnW =
    (containerWidth - colCount * EXPANDED_H_MARGIN * 2) / colCount;
  return {
    left: col * (btnW + EXPANDED_H_MARGIN * 2) + EXPANDED_H_MARGIN,
    top:
      EXPANDED_HEADER_HEIGHT + row * (EXPANDED_ROW_HEIGHT + EXPANDED_ROW_GAP),
    width: btnW,
    height: EXPANDED_ROW_HEIGHT,
    borderRadius: 16,
  };
}

// ─── Individual button ─────────────────────────────────────────────────────────

interface MoodButtonProps {
  mood: (typeof moodScale)[0];
  index: number;
  collapseProgress: SharedValue<number>;
  containerWidth: number;
  isDark: boolean;
  onMoodPress: (mood: number) => void;
  onLongPress: (mood: number) => void;
}

function MoodButton({
  mood,
  index,
  collapseProgress,
  containerWidth,
  isDark,
  onMoodPress,
  onLongPress,
}: MoodButtonProps) {
  const bgHex = isDark ? mood.bgHexDark : mood.bgHex;
  const textHex = isDark ? mood.textHexDark : mood.textHex;

  const containerStyle = useAnimatedStyle(() => {
    const p = collapseProgress.value;
    const c = collapsedPos(index);
    const e = expandedPos(index, containerWidth);
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
    };
  });

  const numberStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(
      collapseProgress.value,
      [0, 1],
      [20, 14],
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
      [10, 0],
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
          backgroundColor: bgHex,
        }}
        onPress={() => onMoodPress(mood.value)}
        onLongPress={() => onLongPress(mood.value)}
        delayLongPress={500}
        accessibilityRole="button"
        accessibilityLabel={getMoodButtonLabel(mood.value, mood.label)}
        accessibilityHint={getMoodButtonHint()}
      >
        <Animated.Text
          style={[
            {
              color: textHex,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
            },
            numberStyle,
          ]}
        >
          {mood.value}
        </Animated.Text>
        <Animated.Text
          style={[
            {
              color: textHex,
              fontSize: 8,
              fontWeight: "600",
              opacity: 0.85,
              textAlign: "center",
            },
            labelStyle,
          ]}
          numberOfLines={1}
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
  const [isCollapsed, setIsCollapsed] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const { get } = useThemeColors();

  const trackBgColor = isDark ? "#2C4038" : "#FDFCFA";
  const trackBorderColor = isDark ? "#3A5448" : "#E5D9BF";
  const textMutedColor = isDark ? colors.sand.textMuted.dark : "#6B5C4A";
  const accentColor = isDark ? colors.primaryMuted.dark : colors.primary.light;
  const negativeColor = isDark
    ? colors.negative.text.dark
    : colors.negative.text.light;

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

  // Gradient scale fades out when collapsing
  const gradientBarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      collapseProgress.value,
      [0, 0.3],
      [1, 0],
      Extrapolation.CLAMP
    ),
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

      <ScrollView
        ref={scrollViewRef}
        horizontal
        bounces={false}
        scrollEnabled={isCollapsed}
        showsHorizontalScrollIndicator={false}
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ width: contentWidth }}
      >
        <View style={{ width: contentWidth, flex: 1 }}>
          {/* Collapsed pill-track background */}
          <Animated.View
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

          {/* Mood buttons — each one is an independent entity that travels between states */}
          {containerWidth > 0 &&
            moodScale.map((mood, index) => (
              <MoodButton
                key={mood.value}
                mood={mood}
                index={index}
                collapseProgress={collapseProgress}
                containerWidth={containerWidth}
                isDark={isDark}
                onMoodPress={onMoodPress}
                onLongPress={onLongPress}
              />
            ))}

        </View>
      </ScrollView>

      {/* Gradient scale bar */}
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 8,
            right: 8,
            top: EXPANDED_GRADIENT_TOP,
          },
          gradientBarStyle,
        ]}
        pointerEvents="none"
      >
        <View
          style={{
            flexDirection: "row",
            height: 4,
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          {colors.moodGradient.map((color, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: color }} />
          ))}
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 8,
            paddingHorizontal: 2,
          }}
        >
          <Text
            style={{ fontSize: 10, fontWeight: "500", color: accentColor }}
          >
            Great
          </Text>
          <Text
            style={{ fontSize: 10, fontWeight: "500", color: negativeColor }}
          >
            Need support
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
