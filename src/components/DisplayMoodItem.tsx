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
      <Text className="text-blue-500 font-bold">Add Note</Text>
    </View>
  </Animated.View>
);

export const DisplayMoodItem = React.memo(
  ({ mood, onSwipeableWillOpen, onLongPress, swipeThreshold }: Props) => {
    const swipeableRef = useRef<any>(null);
    const moodColor =
      moodScale.find((m) => m.value === mood.mood)?.color ?? "text-blue-800";

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
        containerStyle={{ borderRadius: 12 }}
        rightThreshold={swipeThreshold}
        leftThreshold={swipeThreshold}
        onSwipeableOpen={handleSwipeableOpen}
      >
        <Pressable onLongPress={() => onLongPress?.(mood)}>
          <Animated.View className="p-4 rounded-xl bg-white flex-row justify-between items-center">
            <View>
              <Text className={`text-lg font-bold ${moodColor}`}>
                Mood: {mood.mood}
                {mood.note ? ` • ${mood.note}` : ""}
              </Text>
              <Text className="text-xs text-gray-500 mt-1">
                {new Date(mood.timestamp).toLocaleString()}
              </Text>
            </View>
          </Animated.View>
        </Pressable>
      </Swipeable>
    );
  }
);
