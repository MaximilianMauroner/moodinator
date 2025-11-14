import React, { useRef } from "react";
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
          <Animated.View className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex-row justify-between items-center">
            <View className="flex-1 pr-3">
              <View className="flex-row items-center mb-1">
                <View
                  className={`px-2 py-0.5 rounded-full mr-2 ${moodData.bg}`}
                >
                  <Text className={`text-xs font-semibold ${moodColor}`}>
                    {moodData.label}
                  </Text>
                </View>
                <Text className={`text-lg font-extrabold ${moodColor}`}>
                  {mood.mood}
                </Text>
              </View>
              {mood.note ? (
                <Text
                  className="text-sm text-slate-700 dark:text-slate-300"
                  numberOfLines={2}
                >
                  “{mood.note}”
                </Text>
              ) : null}
              {mood.emotions && mood.emotions.length > 0 ? (
                <View className="flex-row flex-wrap gap-2 mt-2">
                  {mood.emotions.map((emotion) => (
                    <View
                      key={`${mood.id}-${emotion}`}
                      className="bg-blue-50 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-blue-100 dark:border-slate-700"
                    >
                      <Text className="text-xs font-medium text-blue-700 dark:text-slate-100">
                        {emotion}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {mood.contextTags && mood.contextTags.length > 0 ? (
                <View className="flex-row flex-wrap gap-2 mt-2">
                  {mood.contextTags.map((context) => (
                    <View
                      key={`${mood.id}-${context}`}
                      className="bg-emerald-50 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-slate-700"
                    >
                      <Text className="text-xs font-medium text-emerald-700 dark:text-emerald-200">
                        {context}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {typeof mood.energy === "number" ? (
                <View className="mt-2 flex-row items-center space-x-2">
                  <Text className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Energy
                  </Text>
                  <Text className="text-sm font-semibold text-orange-600 dark:text-orange-300">
                    {mood.energy}/10
                  </Text>
                </View>
              ) : null}
              <Text className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                {new Date(mood.timestamp).toLocaleString()}
              </Text>
            </View>
          </Animated.View>
        </Pressable>
      </Swipeable>
    );
  }
);
