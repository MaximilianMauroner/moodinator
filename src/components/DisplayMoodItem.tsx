import React, { useRef, useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
  FadeInRight,
  FadeInLeft,
  SlideOutRight,
  SlideOutLeft,
  runOnJS,
} from "react-native-reanimated";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { SwipeDirection } from "../types/mood";
import { MoodEntry } from "@db/types";
import { moodScale } from "@/constants/moodScale";
import { getCategoryColors } from "@/lib/emotionColors";

interface Props {
  mood: MoodEntry;
  onSwipeableWillOpen: (direction: SwipeDirection, mood: MoodEntry) => void;
  onLongPress?: (mood: MoodEntry) => void;
  swipeThreshold: number;
}

const renderRightActions = () => (
  <Animated.View className="flex justify-center items-end h-full">
    <View className="h-full px-6 justify-center bg-red-50 rounded-xl">
      <Text className="text-red-500 font-bold">Delete</Text>
    </View>
  </Animated.View>
);

const renderLeftActions = () => (
  <Animated.View className="flex justify-center items-start h-full">
    <View className="h-full px-6 justify-center bg-blue-50 rounded-xl">
      <Text className="text-blue-500 font-bold">Edit Entry</Text>
    </View>
  </Animated.View>
);

export const DisplayMoodItem = React.memo(
  ({ mood, onSwipeableWillOpen, onLongPress, swipeThreshold }: Props) => {
    const swipeableRef = useRef<any>(null);

    // Pre-compute mood data to avoid accessing .value during render
    const moodData = React.useMemo(() => {
      const moodInfo = moodScale.find((m) => m.value === mood.mood);
      return {
        color: moodInfo?.color ?? "text-blue-800",
        label: moodInfo?.label ?? `Mood ${mood.mood}`,
        bg: moodInfo?.bg ?? "bg-blue-50",
      };
    }, [mood.mood]);

    // Memoize sorted emotions to avoid re-sorting on every render
    const sortedEmotions = useMemo(() => {
      return mood.emotions
        ? [...mood.emotions].sort((a, b) => a.name.localeCompare(b.name))
        : [];
    }, [mood.emotions]);

    const moodColor = moodData.color;

    const handleSwipeableOpen = (direction: string) => {
      // Trigger the action in the parent component
      runOnJS(onSwipeableWillOpen)(direction as SwipeDirection, mood);

      // Close the swipeable after a small delay
      setTimeout(() => {
        if (swipeableRef.current) {
          swipeableRef.current.close();
        }
      }, 300); // Small delay to let the animation complete
    };

    return (
      <Swipeable
        ref={swipeableRef}
        key={mood.id}
        renderRightActions={renderRightActions}
        renderLeftActions={renderLeftActions}
        overshootLeft={false}
        overshootRight={false}
        friction={2}
        containerStyle={{ borderRadius: 14, marginBottom: 12 }}
        rightThreshold={swipeThreshold}
        leftThreshold={swipeThreshold}
        onSwipeableOpen={handleSwipeableOpen}
      >
        <Pressable onLongPress={() => onLongPress?.(mood)}>
          <Animated.View className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-row items-center flex-1 mr-2">
                 <View
                  className={`w-10 h-10 rounded-full mr-3 items-center justify-center ${moodData.bg}`}
                >
                  <Text className={`text-lg font-extrabold ${moodColor}`}>
                    {mood.mood}
                  </Text>
                </View>
                <Text className={`text-base font-bold ${moodColor} flex-1`} numberOfLines={1}>
                    {moodData.label}
                </Text>
              </View>
               <Text className="text-xs text-gray-400 dark:text-slate-500 font-medium mt-1">
                    {new Date(mood.timestamp).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>

            {mood.note ? (
              <Text
                className="text-sm text-slate-600 dark:text-slate-300 mb-3 leading-5"
                numberOfLines={3}
              >
                {mood.note}
              </Text>
            ) : null}

            {(mood.emotions?.length > 0 || mood.contextTags?.length > 0 || typeof mood.energy === "number") && (
              <View className="flex-row flex-wrap gap-2">
                {typeof mood.energy === "number" && (
                    <View className="bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-md border border-orange-100 dark:border-orange-800">
                    <Text className="text-[10px] font-bold text-orange-600 dark:text-orange-300 uppercase tracking-wide">
                        Energy: {mood.energy}/10
                    </Text>
                    </View>
                )}
                {sortedEmotions.map((emotion) => {
                    const colors = getCategoryColors(emotion.category);

                    return (
                      <View
                        key={`${mood.id}-${emotion.name}`}
                        className={`px-2 py-0.5 rounded-md ${colors.bg}`}
                      >
                        <Text className={`text-xs font-medium ${colors.text}`}>
                          {emotion.name}
                        </Text>
                      </View>
                    );
                  })}
                {mood.contextTags?.map((context) => (
                  <View
                    key={`${mood.id}-${context}`}
                    className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md"
                  >
                    <Text className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      #{context}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        </Pressable>
      </Swipeable>
    );
  }
);
