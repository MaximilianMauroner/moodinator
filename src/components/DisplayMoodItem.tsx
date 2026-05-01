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
import { useSettingsStore } from "@/shared/state/settingsStore";

interface Props {
  mood: MoodEntry;
  onSwipeableWillOpen: (direction: SwipeDirection, mood: MoodEntry) => void;
  onLongPress?: (mood: MoodEntry) => void;
  swipeThreshold: number;
}

function MoodTag({
  label,
  backgroundColor,
  textColor,
}: {
  label: string;
  backgroundColor: string;
  textColor: string;
}) {
  return (
    <View
      className="rounded-lg px-2.5 py-1"
      style={{ backgroundColor }}
    >
      <Text className="text-xs font-medium" style={{ color: textColor }}>
        {label}
      </Text>
    </View>
  );
}

function CommentBlock({
  note,
  get,
  variant,
}: {
  note: string | null;
  get: ReturnType<typeof useThemeColors>["get"];
  variant: "minimal" | "compact";
}) {
  if (!note) {
    return null;
  }

  return (
    <View
      className={variant === "compact" ? "mt-3 rounded-xl px-3 py-2.5" : "mb-3 rounded-xl p-3"}
      style={{
        backgroundColor: get("surfaceAlt"),
        borderWidth: variant === "minimal" ? 1 : 0,
        borderColor: get("borderSubtle"),
      }}
    >
      <Text
        className="mb-2 text-[10px] font-bold uppercase tracking-wide"
        style={{ color: get("textMuted") }}
      >
        Comments
      </Text>
      <Text
        className="text-sm leading-5"
        style={{ color: get("textSubtle") }}
        numberOfLines={variant === "compact" ? 3 : 4}
      >
        {note}
      </Text>
    </View>
  );
}

export const DisplayMoodItem = React.memo(function DisplayMoodItem(
  { mood, onSwipeableWillOpen, onLongPress, swipeThreshold }: Props
) {
    const swipeActionPendingRef = useRef(false);
    const { isDark, get, getCategoryColors } = useThemeColors();
    const historyCardStyle = useSettingsStore((state) => state.historyCardStyle);
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
    const allCompactTags = useMemo(
      () => [
        ...sortedEmotions.map((emotion) => ({
          key: `${mood.id}-${emotion.name}`,
          label: emotion.name,
          colorSet: getCategoryColors(emotion.category),
        })),
        ...(mood.contextTags?.map((ctx) => ({
          key: `${mood.id}-${ctx}`,
          label: `#${ctx}`,
          colorSet: getCategoryColors("neutral"),
        })) ?? []),
      ],
      [getCategoryColors, mood.contextTags, mood.id, sortedEmotions]
    );

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
                  backgroundColor:
                    historyCardStyle === "compact" ? get("surfaceAlt") : get("background"),
                  borderWidth: historyCardStyle === "compact" ? (isDark ? 1 : 0) : 1,
                  borderColor:
                    historyCardStyle === "compact"
                      ? isDark ? "rgba(168, 197, 168, 0.14)" : "transparent"
                      : isDark ? `${moodData.textHex}40` : `${moodData.textHex}35`,
                  shadowColor: historyCardStyle === "compact"
                    ? (isDark ? "#000" : colors.sand.text.light)
                    : "transparent",
                  shadowOffset: { width: 0, height: isDark ? 3 : 4 },
                  shadowOpacity: historyCardStyle === "compact" ? (isDark ? 0.28 : 0.06) : 0,
                  shadowRadius: historyCardStyle === "compact" ? (isDark ? 8 : 10) : 0,
                  elevation: historyCardStyle === "compact" ? (isDark ? 4 : 3) : 0,
                }}
              >
                {historyCardStyle === "compact" ? (
                  <View className="px-4 py-3">
                    <View className="flex-row items-center gap-3">
                      <View
                        className="h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: moodData.textHex }}
                      >
                        <Text
                          className="text-sm font-bold"
                          style={{ color: get("textInverse"), fontVariant: ["tabular-nums"] }}
                        >
                          {mood.mood}
                        </Text>
                      </View>

                      <View className="flex-1">
                        <View className="flex-row flex-wrap items-center gap-1.5">
                          <Text className="text-sm font-semibold" style={{ color: get("text") }}>
                            {moodData.label}
                          </Text>
                          {allCompactTags.map((tag) => (
                            <MoodTag
                              key={tag.key}
                              label={tag.label}
                              backgroundColor={tag.colorSet.bg}
                              textColor={tag.colorSet.text}
                            />
                          ))}
                        </View>
                      </View>

                      <View className="items-end">
                        <Text className="text-xs font-medium" style={{ color: get("textMuted") }}>
                          {formattedTime}
                        </Text>
                        {typeof mood.energy === "number" ? (
                          <Text className="text-[10px]" style={{ color: get("textMuted") }}>
                            Energy {mood.energy}/10
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <CommentBlock note={mood.note} get={get} variant="compact" />
                  </View>
                ) : (
                  <View className="p-4">
                    <View className="mb-2 flex-row items-baseline justify-between">
                      <View className="flex-row items-baseline gap-2">
                        <Text
                          style={{
                            fontSize: 36,
                            fontWeight: "900",
                            color: moodData.textHex,
                            fontVariant: ["tabular-nums"],
                            lineHeight: 38,
                          }}
                        >
                          {mood.mood}
                        </Text>
                        <Text
                          className="text-sm font-semibold uppercase tracking-wide"
                          style={{ color: `${moodData.textHex}BB` }}
                        >
                          {moodData.label}
                        </Text>
                      </View>
                      <Text className="text-xs" style={{ color: get("textMuted") }}>
                        {formattedTime}
                      </Text>
                    </View>

                    <View
                      className="mb-3 h-px"
                      style={{
                        backgroundColor:
                          isDark ? "rgba(168,197,168,0.12)" : "rgba(61,53,42,0.08)",
                      }}
                    />

                    <Text className="mb-3 text-xs" style={{ color: get("textMuted") }}>
                      {formattedDate}
                      {typeof mood.energy === "number" ? ` · Energy ${mood.energy}/10` : ""}
                    </Text>

                    <CommentBlock note={mood.note} get={get} variant="minimal" />

                    {(sortedEmotions.length > 0 || (mood.contextTags?.length ?? 0) > 0) && (
                      <View className="flex-row flex-wrap gap-2">
                        {sortedEmotions.map((emotion) => {
                          const catColors = getCategoryColors(emotion.category);

                          return (
                            <MoodTag
                              key={`${mood.id}-${emotion.name}`}
                              label={emotion.name}
                              backgroundColor={catColors.bg}
                              textColor={catColors.text}
                            />
                          );
                        })}
                        {mood.contextTags?.map((ctx) => {
                          const ctxColors = getCategoryColors("neutral");

                          return (
                            <MoodTag
                              key={`${mood.id}-${ctx}`}
                              label={`#${ctx}`}
                              backgroundColor={ctxColors.bg}
                              textColor={ctxColors.text}
                            />
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}
              </View>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>
    );
  }
);
