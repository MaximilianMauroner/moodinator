import React from "react";
import { View } from "react-native";
import { MoodButtonsDetailed } from "@/components/MoodButtonsDetailed";

interface MoodButtonSelectorProps {
  onMoodPress: (mood: number) => void;
  onLongPress: (mood: number) => void;
}

export function DetailedMoodButtonSelector({
  onMoodPress,
  onLongPress,
}: MoodButtonSelectorProps) {
  return (
    <View>
      <MoodButtonsDetailed
        onMoodPress={onMoodPress}
        onLongPress={onLongPress}
      />
    </View>
  );
}
