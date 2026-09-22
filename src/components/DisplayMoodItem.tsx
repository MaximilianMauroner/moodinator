import React, { useCallback, useMemo, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import type { SwipeDirection } from "../types/mood";
import { MoodEntry } from "@db/types";
import { getMoodRatingDisplay } from "@/constants/moodScaleInterpretation";
import { useThemeColors, colors } from "@/constants/colors";
import { Alert } from "@/components/ui/AppAlert";
import { getMoodItemLabel, getMoodItemHint } from "@/constants/accessibility";
import { motion, springs } from "@/constants/motion";
import { haptics } from "@/lib/haptics";
import { getEntryLocalDateLabel, getEntryLocalTimeLabel } from "@/lib/entryTimezone";
import { useSettingsStore } from "@/shared/state/settingsStore";

interface Props {
  mood: MoodEntry;
  onSwipeableWillOpen: (direction: SwipeDirection, mood: MoodEntry) => void;
  onLongPress?: (mood: MoodEntry) => void;
  onPress?: (mood: MoodEntry) => void;
  onEdit?: (mood: MoodEntry) => void;
  onDelete?: (mood: MoodEntry) => void;
  swipeThreshold: number;
}

const hasQaMetadata = /^[0-9a-f]{40}$/.test(
  String(Constants.expoConfig?.extra?.qaSourceSha ?? ""),
);

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
  timestamp,
  get,
  variant,
}: {
  note: string | null;
  timestamp: number;
  get: ReturnType<typeof useThemeColors>["get"];
  variant: "minimal" | "compact";
}) {
  if (!note) {
    return null;
  }

  return (
    <View
      className={variant === "compact" ? "mt-3 rounded-xl px-3 py-2.5" : "mb-3 rounded-xl px-3 py-2.5"}
      style={{
        backgroundColor: get("surfaceAlt"),
      }}
    >
      <Text
        className="mb-2 text-[10px] font-bold uppercase tracking-wide"
        style={{ color: get("textMuted") }}
      >
        Notes
      </Text>
      <Text
        testID={`mood-entry-note-${timestamp}`}
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
  { mood, onSwipeableWillOpen, onLongPress, onPress, onEdit, onDelete, swipeThreshold }: Props
) {
    const swipeActionPendingRef = useRef(false);
    const { isDark, get, getCategoryColors } = useThemeColors();
    const { width: windowWidth } = useWindowDimensions();
    const historyCardStyle = useSettingsStore((state) => state.historyCardStyle);
    const translateX = useSharedValue(0);
    const pressScale = useSharedValue(1);
    // Delete-exit animation: slide the card off-screen, fade it, then collapse
    // the row height so the gap closes smoothly before the data is removed.
    const deleteFade = useSharedValue(1);
    const deleteCollapse = useSharedValue(1);
    const isDeleting = useSharedValue(false);
    const measuredHeight = useSharedValue(0);

    // FlashList recycles this component across different entries. Reset the
    // exit-animation state synchronously when the underlying entry changes so a
    // recycled row never inherits a previous row's mid-delete (collapsed/faded)
    // values.
    const lastIdRef = useRef(mood.id);
    if (lastIdRef.current !== mood.id) {
      lastIdRef.current = mood.id;
      isDeleting.value = false;
      deleteFade.value = 1;
      deleteCollapse.value = 1;
      translateX.value = 0;
    }

    const moodData = useMemo(() => {
      const moodInfo = getMoodRatingDisplay(mood.mood, isDark, mood.moodScale);
      return {
        color: moodInfo.color,
        textHex: moodInfo.colorHex,
        label: moodInfo.label,
        bg: moodInfo.bg,
        bgHex: moodInfo.backgroundHex,
        borderColor: moodInfo.borderColor,
      };
    }, [mood.mood, mood.moodScale, isDark]);

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

    const formattedDate = getEntryLocalDateLabel(mood);
    const formattedTime = getEntryLocalTimeLabel(mood);

    const accessibilityLabel = getMoodItemLabel(
      mood.mood,
      moodData.label,
      formattedDate,
      formattedTime,
    );

    const triggerSwipeAction = useCallback(
      (direction: SwipeDirection) => {
        if (swipeActionPendingRef.current) return;
        swipeActionPendingRef.current = true;

        if (direction === "left") {
          haptics.tap();
        }

        setTimeout(() => {
          swipeActionPendingRef.current = false;
          onSwipeableWillOpen(direction, mood);
        }, 120);
      },
      [mood, onSwipeableWillOpen]
    );

    const triggerDelete = useCallback(() => {
      if (swipeActionPendingRef.current) return;
      swipeActionPendingRef.current = true;

      isDeleting.value = true;

      // Slide the card the rest of the way off-screen and fade it out, then
      // collapse the row before handing off to the store removal + undo toast.
      translateX.set(
        withTiming(-windowWidth, {
          duration: 220,
          easing: Easing.in(Easing.cubic),
        })
      );
      deleteFade.set(withTiming(0, { duration: 200 }));
      deleteCollapse.set(
        withTiming(0, { duration: 260, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) {
            runOnJS(onSwipeableWillOpen)("right", mood);
          }
        })
      );
    }, [
      deleteCollapse,
      deleteFade,
      isDeleting,
      mood,
      onSwipeableWillOpen,
      translateX,
      windowWidth,
    ]);

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
              translateX.set(withTiming(0, { duration: motion.duration.fast }));
              triggerSwipeAction("left");
              return;
            }

            if (shouldDelete) {
              triggerDelete();
              return;
            }

            translateX.set(withSpring(0, springs.gentle));
          })
          .onFinalize(() => {
            // Don't fight the delete-exit animation when it's running.
            if (isDeleting.value) return;
            translateX.set(withSpring(0, springs.gentle));
          }),
      [isDeleting, swipeThreshold, translateX, triggerDelete, triggerSwipeAction]
    );

    const cardAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }, { scale: pressScale.value }],
    }));

    const containerAnimatedStyle = useAnimatedStyle(() => ({
      height: isDeleting.value
        ? measuredHeight.value * deleteCollapse.value
        : undefined,
      marginBottom: isDeleting.value ? 12 * deleteCollapse.value : 12,
      opacity: isDeleting.value ? deleteFade.value : 1,
    }));

    const handleContainerLayout = useCallback(
      (event: LayoutChangeEvent) => {
        if (!isDeleting.value) {
          measuredHeight.value = event.nativeEvent.layout.height;
        }
      },
      [isDeleting, measuredHeight]
    );

    const showActions = useCallback(() => {
      Alert.alert(
        "Entry actions",
        formattedDate,
        [
          { text: "Edit entry", onPress: () => onEdit?.(mood) },
          { text: "Change date & time", onPress: () => onLongPress?.(mood) },
          { text: "Delete entry", style: "destructive", onPress: () => onDelete?.(mood) },
        ],
        { cancelable: true }
      );
    }, [formattedDate, mood, onDelete, onEdit, onLongPress]);

    const handleAccessibilityAction = useCallback(
      (event: { nativeEvent: { actionName: string } }) => {
        switch (event.nativeEvent.actionName) {
          case "activate":
            onPress?.(mood);
            break;
          case "edit":
            onEdit?.(mood);
            break;
          case "changeDate":
            onLongPress?.(mood);
            break;
          case "delete":
            onDelete?.(mood);
            break;
        }
      },
      [mood, onDelete, onEdit, onLongPress, onPress]
    );

    return (
      <Animated.View
        testID={`mood-entry-stable-${mood.timestamp}`}
        onLayout={handleContainerLayout}
        style={[{ borderRadius: 16, overflow: "hidden" }, containerAnimatedStyle]}
      >
        {hasQaMetadata ? (
          <>
            <View
              testID={`mood-entry-offset-${mood.timestamp}-${mood.utcOffsetMinutes ?? "null"}`}
              collapsable={false}
            />
            <View
              testID={`mood-entry-scale-${mood.timestamp}-${mood.moodScale.version}-${mood.moodScale.min}-${mood.moodScale.max}-${mood.moodScale.lowerIsBetter}`}
              collapsable={false}
            />
            <View testID={`mood-entry-emotion-count-${mood.timestamp}-${mood.emotions.length}`} collapsable={false} />
            <View testID={`mood-entry-context-count-${mood.timestamp}-${mood.contextTags.length}`} collapsable={false} />
            {typeof mood.energy === "number" ? (
              <View testID={`mood-entry-energy-${mood.timestamp}-${mood.energy}`} collapsable={false} />
            ) : null}
            {mood.emotions.map((emotion) => (
              <View
                key={`qa-emotion-${emotion.name}`}
                testID={`mood-entry-emotion-${mood.timestamp}-${emotion.name}-${emotion.category}-${emotion.energy ?? "null"}`}
                collapsable={false}
              />
            ))}
            {mood.contextTags.map((context) => (
              <View
                key={`qa-context-${context}`}
                testID={`mood-entry-context-${mood.timestamp}-${context}`}
                collapsable={false}
              />
            ))}
          </>
        ) : null}
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
              onPress={() => onPress?.(mood)}
              onPressIn={() => {
                pressScale.value = withSpring(0.985, springs.snap);
              }}
              onPressOut={() => {
                pressScale.value = withSpring(1, springs.gentle);
              }}
              onLongPress={() => {
                haptics.tap();
                onLongPress?.(mood);
              }}
              accessibilityRole="button"
              testID={`mood-entry-${mood.timestamp}`}
              accessibilityLabel={accessibilityLabel}
              accessibilityHint={getMoodItemHint()}
              accessibilityActions={[
                { name: "activate", label: "View entry details" },
                { name: "edit", label: "Edit entry" },
                { name: "changeDate", label: "Change date and time" },
                { name: "delete", label: "Delete entry" },
              ]}
              onAccessibilityAction={handleAccessibilityAction}
            >
              <View
                style={{
                  borderRadius: 16,
                  backgroundColor:
                    historyCardStyle === "compact" ? get("surfaceAlt") : get("surface"),
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor:
                    historyCardStyle === "compact"
                      ? isDark ? "rgba(78, 101, 86, 0.55)" : "rgba(229, 217, 191, 0.55)"
                      : isDark ? "rgba(224, 201, 147, 0.18)" : "rgba(157, 134, 96, 0.22)",
                  shadowColor: isDark ? colors.background.dark : colors.sand.text.light,
                  shadowOffset: { width: 0, height: historyCardStyle === "compact" ? 3 : 2 },
                  shadowOpacity: historyCardStyle === "compact"
                    ? (isDark ? 0.28 : 0.06)
                    : (isDark ? 0.2 : 0.045),
                  shadowRadius: historyCardStyle === "compact" ? (isDark ? 8 : 10) : 9,
                  elevation: historyCardStyle === "compact" ? (isDark ? 4 : 3) : 2,
                }}
              >
                {historyCardStyle === "compact" ? (
                  <View className="px-4 py-3">
                    <View className="flex-row items-center gap-3">
                      <View
                        className="h-8 w-8 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: moodData.bgHex,
                          borderColor: moodData.textHex,
                          borderWidth: StyleSheet.hairlineWidth,
                        }}
                      >
                        <Text
                          testID={`mood-entry-rating-${mood.timestamp}`}
                          className="text-sm font-bold"
                          style={{ color: moodData.textHex, fontVariant: ["tabular-nums"] }}
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
                        <Text className="text-[10px]" style={{ color: get("textMuted") }}>
                          {formattedDate}
                        </Text>
                        {typeof mood.energy === "number" ? (
                          <Text className="text-[10px]" style={{ color: get("textMuted") }}>
                            Energy {mood.energy}/10
                          </Text>
                        ) : null}
                      </View>

                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          showActions();
                        }}
                        className="h-11 w-11 items-center justify-center rounded-full"
                        accessibilityRole="button"
                        testID={`mood-entry-actions-${mood.timestamp}`}
                        accessibilityLabel={`Actions for ${moodData.label} entry`}
                        accessibilityHint="Edit, change date and time, or delete this entry"
                      >
                        <Ionicons name="ellipsis-horizontal" size={22} color={get("textMuted")} />
                      </Pressable>
                    </View>

                    <CommentBlock
                      note={mood.note}
                      timestamp={mood.timestamp}
                      get={get}
                      variant="compact"
                    />
                  </View>
                ) : (
                  <View className="p-4">
                    <View className="mb-2 flex-row items-center justify-between">
                      <View className="flex-row items-baseline gap-2">
                        <Text
                          testID={`mood-entry-rating-${mood.timestamp}`}
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
                      <View className="flex-row items-center">
                        <Text className="text-xs" style={{ color: get("textMuted") }}>
                          {formattedTime}
                        </Text>
                        <Pressable
                          onPress={(event) => {
                            event.stopPropagation();
                            showActions();
                          }}
                          className="ml-1 h-11 w-11 items-center justify-center rounded-full"
                          accessibilityRole="button"
                          testID={`mood-entry-actions-${mood.timestamp}`}
                          accessibilityLabel={`Actions for ${moodData.label} entry`}
                          accessibilityHint="Edit, change date and time, or delete this entry"
                        >
                          <Ionicons name="ellipsis-horizontal" size={22} color={get("textMuted")} />
                        </Pressable>
                      </View>
                    </View>

                    <Text className="mb-3 text-xs" style={{ color: get("textMuted") }}>
                      {formattedDate}
                      {typeof mood.energy === "number" ? ` · Energy ${mood.energy}/10` : ""}
                    </Text>

                    <CommentBlock
                      note={mood.note}
                      timestamp={mood.timestamp}
                      get={get}
                      variant="minimal"
                    />

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
      </Animated.View>
    );
  }
);
