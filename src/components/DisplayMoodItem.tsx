import React, { useRef, useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
  runOnJS,
} from "react-native-reanimated";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { SwipeDirection } from "../types/mood";
import { MoodEntry } from "@db/types";
import { moodScale } from "@/constants/moodScale";
import { useColorScheme } from "@/hooks/useColorScheme";
import { getMoodItemLabel, getMoodItemHint } from "@/constants/accessibility";

interface Props {
  mood: MoodEntry;
  onSwipeableWillOpen: (direction: SwipeDirection, mood: MoodEntry) => void;
  onLongPress?: (mood: MoodEntry) => void;
  swipeThreshold: number;
}

// Organic category colors
const getCategoryColors = (category: string | undefined, isDark: boolean) => {
  switch (category) {
    case "positive":
      return {
        bg: isDark ? "#2D3D2D" : "#E8EFE8",
        text: isDark ? "#A8C5A8" : "#5B8A5B",
      };
    case "negative":
      return {
        bg: isDark ? "#3D2822" : "#FDE8E4",
        text: isDark ? "#F5A899" : "#C75441",
      };
    default:
      return {
        bg: isDark ? "#302A22" : "#F9F5ED",
        text: isDark ? "#D4C4A0" : "#9D8660",
      };
  }
};

export const DisplayMoodItem = React.memo(
  ({ mood, onSwipeableWillOpen, onLongPress, swipeThreshold }: Props) => {
    const swipeableRef = useRef<any>(null);
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

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
          style={{ backgroundColor: isDark ? "#3D2822" : "#FDE8E4" }}
        >
          <Text
            className="text-sm font-semibold"
            style={{ color: isDark ? "#F5A899" : "#C75441" }}
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
          style={{ backgroundColor: isDark ? "#2D3D2D" : "#E8EFE8" }}
        >
          <Text
            className="text-sm font-semibold"
            style={{ color: isDark ? "#A8C5A8" : "#5B8A5B" }}
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
              backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
              shadowColor: isDark ? "#000" : "#9D8660",
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
                    style={{ backgroundColor: isDark ? "#352D22" : "#F9F5ED" }}
                  >
                    <Text
                      className="text-[10px] font-semibold"
                      style={{ color: isDark ? "#D4C4A0" : "#9D8660" }}
                    >
                      Energy {mood.energy}/10
                    </Text>
                  </View>
                )}
              </View>

              {/* Timestamp */}
              <Text
                className="text-xs"
                style={{ color: isDark ? "#6B5C4A" : "#BDA77D" }}
              >
                {formattedDate} · {formattedTime}
              </Text>
            </View>

            {/* Note */}
            {mood.note ? (
              <View
                className="rounded-xl p-3 mb-3"
                style={{ backgroundColor: isDark ? "#2A2520" : "#F9F5ED" }}
              >
                <Text
                  className="text-sm leading-5"
                  style={{ color: isDark ? "#D4C4A0" : "#6B5C4A" }}
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
                  const colors = getCategoryColors(emotion.category, isDark);
                  return (
                    <View
                      key={`${mood.id}-${emotion.name}`}
                      className="px-2.5 py-1 rounded-lg"
                      style={{ backgroundColor: colors.bg }}
                    >
                      <Text
                        className="text-xs font-medium"
                        style={{ color: colors.text }}
                      >
                        {emotion.name}
                      </Text>
                    </View>
                  );
                })}
                {mood.contextTags?.map((context) => (
                  <View
                    key={`${mood.id}-${context}`}
                    className="px-2.5 py-1 rounded-lg"
                    style={{ backgroundColor: isDark ? "#2D2A33" : "#EFECF2" }}
                  >
                    <Text
                      className="text-xs font-medium"
                      style={{ color: isDark ? "#C4BBCF" : "#695C78" }}
                    >
                      #{context}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Pressable>
      </Swipeable>
    );
  }
);
