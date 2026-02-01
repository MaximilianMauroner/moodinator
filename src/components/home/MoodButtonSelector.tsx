import React from "react";
import { View } from "react-native";
import { MoodButtonsDetailed } from "@/components/MoodButtonsDetailed";
import { MoodButtonsCompact } from "@/components/MoodButtonsCompact";

interface MoodButtonSelectorProps {
  showDetailedLabels: boolean;
  onMoodPress: (mood: number) => void;
  onLongPress: (mood: number) => void;
}

/**
 * Wrapper component that renders either detailed or compact mood buttons
 * based on user preference.
 */
export function MoodButtonSelector({
  showDetailedLabels,
  onMoodPress,
  onLongPress,
}: MoodButtonSelectorProps) {
  return (
    <View>
      {showDetailedLabels ? (
        <MoodButtonsDetailed
          onMoodPress={onMoodPress}
          onLongPress={onLongPress}
        />
      ) : (
        <MoodButtonsCompact
          onMoodPress={onMoodPress}
          onLongPress={onLongPress}
        />
      )}
    </View>
  );
}

export default MoodButtonSelector;
