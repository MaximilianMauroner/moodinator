import React, { useCallback, useMemo, useRef } from "react";
import { View, Text, Pressable } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { SwipeDirection } from "../types/mood";
import { MoodEntry } from "@db/types";
import { moodScale } from "@/constants/moodScale";
import { useThemeColors, colors } from "@/constants/colors";
import { getMoodItemLabel, getMoodItemHint } from "@/constants/accessibility";
import { haptics } from "@/lib/haptics";

interface Props {
  mood: MoodEntry;
  onSwipeableWillOpen: (direction: SwipeDirection, mood: MoodEntry) => void;
  onLongPress?: (mood: MoodEntry) => void;
  swipeThreshold: number;
}

export const DisplayMoodItem = React.memo(function DisplayMoodItem(
  { mood, onSwipeableWillOpen, onLongPress, swipeThreshold }: Props
) {
    const swipeActionPendingRef = useRef(false);
    const { isDark, get, getCategoryColors } = useThemeColors();
    const translateX = useSharedValue(0);

    const moodData = useMemo(() => {
      const moodInfo = moodScale.find((m) => m.value === mood.mood);
      return {
        color: moodInfo?.color ?? "text-sand-600",
        textHex: isDark
          ? (moodInfo?.textHexDark ?? "#D4C4A0")
          : (moodInfo?.textHex ?? "#9D8660"),
        label: moodInfo?.label ?? `Mood ${mood.mood}`,
        bg: moodInfo?.bg ?? "bg-sand-100",
        bgHex: isDark
          ? (moodInfo?.bgHexDark ?? "#302A22")
          : (moodInfo?.bgHex ?? "#F9F5ED"),
        borderColor: moodInfo?.borderColor ?? "#E5D9BF",
      };
    }, [mood.mood, isDark]);

    const sortedEmotions = useMemo(() => {
      return mood.emotions
        ? [...mood.emotions].sort((a, b) => a.name.localeCompare(b.name))
        : [];
    }, [mood.emotions]);

    const formattedDate = new Date(mood.timestamp).toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const formattedTime = new Date(mood.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const accessibilityLabel = getMoodItemLabel(
      mood.mood,
      moodData.label,
      new Date(mood.timestamp)
    );

    const triggerSwipeAction = useCallback(
      (direction: SwipeDirection) => {
        if (swipeActionPendingRef.current) return;
        swipeActionPendingRef.current = true;

        if (direction === "left") {
          haptics.swipeThreshold();
        } else {
          haptics.destructive();
        }

        setTimeout(() => {
          swipeActionPendingRef.current = false;
          onSwipeableWillOpen(direction, mood);
        }, 120);
      },
      [mood, onSwipeableWillOpen]
    );

    const panGesture = useMemo(
      () =>
        Gesture.Pan()
          .activeOffsetX([-12, 12])
          .failOffsetY([-12, 12])
          .runOnJS(true)
          .onUpdate((event) => {
            const nextValue = Math.max(
              -swipeThreshold,
              Math.min(swipeThreshold, event.translationX)
            );
            translateX.set(nextValue);
          })
          .onEnd((event) => {
            const shouldEdit = event.translationX > swipeThreshold * 0.8;
            const shouldDelete = event.translationX < -swipeThreshold * 0.8;

            if (shouldEdit) {
              translateX.set(withTiming(0, { duration: 140 }));
              triggerSwipeAction("left");
              return;
            }

            if (shouldDelete) {
              translateX.set(withTiming(0, { duration: 140 }));
              triggerSwipeAction("right");
              return;
            }

            translateX.set(withSpring(0, { damping: 18, stiffness: 220 }));
          })
          .onFinalize(() => {
            translateX.set(withSpring(0, { damping: 18, stiffness: 220 }));
          }),
      [swipeThreshold, translateX, triggerSwipeAction]
    );

    const cardAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
    }));

    return (
      <View style={{ marginBottom: 12, borderRadius: 16, overflow: "hidden" }}>
        <View
          pointerEvents="none"
          className="absolute inset-0 flex-row justify-between"
        >
          <View
            className="justify-center px-6"
            style={{ backgroundColor: isDark ? colors.swipeEdit.bg.dark : colors.swipeEdit.bg.light }}
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: isDark ? colors.swipeEdit.text.dark : colors.swipeEdit.text.light }}
            >
              Edit
            </Text>
          </View>
          <View
            className="justify-center px-6"
            style={{ backgroundColor: isDark ? colors.swipeDelete.bg.dark : colors.swipeDelete.bg.light }}
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: isDark ? colors.swipeDelete.text.dark : colors.swipeDelete.text.light }}
            >
              Delete
            </Text>
          </View>
        </View>

        <GestureDetector gesture={panGesture}>
          <Animated.View style={cardAnimatedStyle}>
            <Pressable
              onLongPress={() => {
                haptics.swipeThreshold();
                onLongPress?.(mood);
              }}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              accessibilityHint={getMoodItemHint()}
            >
              <View
                className="rounded-2xl overflow-hidden"
                style={{
                  backgroundColor: get("surface"),
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark ? "rgba(168, 197, 168, 0.14)" : "transparent",
                  shadowColor: isDark ? "#000" : colors.sand.text.light,
                  shadowOffset: { width: 0, height: isDark ? 3 : 4 },
                  shadowOpacity: isDark ? 0.35 : 0.08,
                  shadowRadius: isDark ? 8 : 12,
                  elevation: isDark ? 4 : 3,
                }}
              >
                <View className="flex-row">
                  {/* Left accent bar - mood-colored visual indicator */}
                  <View
                    style={{
                      width: 4,
                      backgroundColor: moodData.textHex,
                    }}
                  />

                  {/* Main content */}
                  <View className="flex-1 p-4">
                    {/* Header row */}
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="flex-row items-center flex-1">
                        {/* Mood pill */}
                        <View
                          className="flex-row items-center px-3 py-1.5 rounded-xl mr-3"
                          style={{ backgroundColor: moodData.bgHex }}
                        >
                          <Text
                            className="text-lg font-bold mr-1.5"
                            style={{ color: moodData.textHex, fontVariant: ["tabular-nums"] }}
                          >
                            {mood.mood}
                          </Text>
                          <Text
                            className="text-sm font-semibold"
                            style={{ color: moodData.textHex }}
                          >
                            {moodData.label}
                          </Text>
                        </View>

                        {/* Energy badge */}
                        {typeof mood.energy === "number" && (
                          <View
                            className="px-2 py-1 rounded-lg"
                            style={{ backgroundColor: isDark ? colors.sand.bgHover.dark : colors.sand.bg.light }}
                          >
                            <Text
                              className="text-[10px] font-semibold"
                              style={{ color: isDark ? colors.sand.text.dark : colors.sand.text.light }}
                            >
                              Energy {mood.energy}/10
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Timestamp */}
                      <Text
                        className="text-xs"
                        style={{ color: get("textMuted") }}
                      >
                        {formattedDate} · {formattedTime}
                      </Text>
                    </View>

                    {/* Note */}
                    {mood.note ? (
                      <View
                        className="rounded-xl p-3 mb-3"
                        style={{ backgroundColor: get("surfaceAlt") }}
                      >
                        <Text
                          className="text-sm leading-5"
                          style={{ color: get("textSubtle") }}
                          numberOfLines={3}
                        >
                          {mood.note}
                        </Text>
                      </View>
                    ) : null}

                    {/* Tags */}
                    {(sortedEmotions.length > 0 || (mood.contextTags?.length ?? 0) > 0) && (
                      <View className="flex-row flex-wrap gap-2">
                        {sortedEmotions.map((emotion) => {
                          const catColors = getCategoryColors(emotion.category);
                          return (
                            <View
                              key={`${mood.id}-${emotion.name}`}
                              className="px-2.5 py-1 rounded-lg"
                              style={{ backgroundColor: catColors.bg }}
                            >
                              <Text
                                className="text-xs font-medium"
                                style={{ color: catColors.text }}
                              >
                                {emotion.name}
                              </Text>
                            </View>
                          );
                        })}
                        {mood.contextTags?.map((ctx) => {
                          const ctxColors = getCategoryColors("neutral");
                          return (
                            <View
                              key={`${mood.id}-${ctx}`}
                              className="px-2.5 py-1 rounded-lg"
                              style={{ backgroundColor: ctxColors.bg }}
                            >
                              <Text
                                className="text-xs font-medium"
                                style={{ color: ctxColors.text }}
                              >
                                #{ctx}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>
    );
  }
);
