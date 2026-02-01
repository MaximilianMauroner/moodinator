import React, { useRef, useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
  runOnJS,
} from "react-native-reanimated";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { SwipeDirection } from "../types/mood";
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

export const DisplayMoodItem = React.memo(
  ({ mood, onSwipeableWillOpen, onLongPress, swipeThreshold }: Props) => {
    const swipeableRef = useRef<typeof Swipeable.prototype | null>(null);
    const { isDark, get, getCategoryColors } = useThemeColors();

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

    const handleSwipeableOpen = (direction: string) => {
      // Haptic feedback based on swipe direction
      if (direction === "right") {
        haptics.warning(); // Delete action
      } else {
        haptics.light(); // Edit action
      }
      runOnJS(onSwipeableWillOpen)(direction as SwipeDirection, mood);
      setTimeout(() => {
        if (swipeableRef.current) {
          swipeableRef.current.close();
        }
      }, 300);
    };

    const formattedDate = new Date(mood.timestamp).toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const formattedTime = new Date(mood.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const renderRightActions = () => (
      <Animated.View className="justify-center items-center h-full">
        <View
          className="h-full px-6 justify-center rounded-r-2xl"
          style={{ backgroundColor: isDark ? colors.swipeDelete.bg.dark : colors.swipeDelete.bg.light }}
        >
          <Text
            className="text-sm font-semibold"
            style={{ color: isDark ? colors.swipeDelete.text.dark : colors.swipeDelete.text.light }}
          >
            Delete
          </Text>
        </View>
      </Animated.View>
    );

    const renderLeftActions = () => (
      <Animated.View className="justify-center items-start h-full">
        <View
          className="h-full px-6 justify-center rounded-l-2xl"
          style={{ backgroundColor: isDark ? colors.swipeEdit.bg.dark : colors.swipeEdit.bg.light }}
        >
          <Text
            className="text-sm font-semibold"
            style={{ color: isDark ? colors.swipeEdit.text.dark : colors.swipeEdit.text.light }}
          >
            Edit
          </Text>
        </View>
      </Animated.View>
    );

    const accessibilityLabel = getMoodItemLabel(
      mood.mood,
      moodData.label,
      new Date(mood.timestamp)
    );

    return (
      <Swipeable
        ref={swipeableRef}
        key={mood.id}
        renderRightActions={renderRightActions}
        renderLeftActions={renderLeftActions}
        overshootLeft={false}
        overshootRight={false}
        friction={2}
        containerStyle={{ borderRadius: 16, marginBottom: 12 }}
        rightThreshold={swipeThreshold}
        leftThreshold={swipeThreshold}
        onSwipeableOpen={handleSwipeableOpen}
      >
        <Pressable
          onLongPress={() => onLongPress?.(mood)}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={getMoodItemHint()}
        >
          <View
            className="rounded-2xl p-4"
            style={{
              backgroundColor: get("surface"),
              shadowColor: isDark ? "#000" : colors.sand.text.light,
              shadowOffset: { width: 0, height: isDark ? 2 : 4 },
              shadowOpacity: isDark ? 0.25 : 0.08,
              shadowRadius: isDark ? 4 : 12,
              elevation: 3,
            }}
          >
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
        </Pressable>
      </Swipeable>
    );
  }
);
