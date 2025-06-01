import React from "react";
import { View, Text } from "react-native";
import { HapticTab } from "./HapticTab";
import { moodScale } from "@/constants/moodScale";

interface MoodButtonsDetailedProps {
  onMoodPress: (mood: number) => void;
  onLongPress: (mood: number) => void;
}

export const MoodButtonsDetailed: React.FC<MoodButtonsDetailedProps> = ({
  onMoodPress,
  onLongPress,
}) => {
  return (
    <View className="flex-row flex-wrap justify-between mb-2">
      {/* Zero button (full width) */}
      <HapticTab
        key={moodScale[0].value}
        className={`items-center justify-center h-20 rounded-lg shadow-sm ${moodScale[0].bg} mb-2 w-full`}
        onPress={() => onMoodPress(moodScale[0].value)}
        onLongPress={() => onLongPress(moodScale[0].value)}
        delayLongPress={500}
      >
        <Text className={`text-lg font-bold ${moodScale[0].color}`}>
          {moodScale[0].value}
        </Text>
        <Text
          className={`text-xs font-medium ${moodScale[0].color} text-center px-1 mt-1`}
          numberOfLines={2}
        >
          {moodScale[0].description}
        </Text>
      </HapticTab>

      {/* Remaining buttons (two columns) */}
      {moodScale.slice(1, 6).map((mood) => (
        <HapticTab
          key={mood.value}
          className={`items-center justify-center h-24 rounded-lg shadow-sm ${mood.bg} mb-2`}
          style={{ width: "48%" }}
          onPress={() => onMoodPress(mood.value)}
          onLongPress={() => onLongPress(mood.value)}
          delayLongPress={500}
        >
          <Text className={`text-lg font-bold ${mood.color}`}>
            {mood.value}
          </Text>
          <Text
            className={`text-xs font-medium ${mood.color} text-center px-1 mt-1`}
            numberOfLines={2}
          >
            {mood.description}
          </Text>
        </HapticTab>
      ))}

      {moodScale.slice(6).map((mood) => (
        <HapticTab
          key={mood.value}
          className={`items-center justify-center h-24 rounded-lg shadow-sm ${mood.bg} mb-2`}
          style={{ width: "48%" }}
          onPress={() => onMoodPress(mood.value)}
          onLongPress={() => onLongPress(mood.value)}
          delayLongPress={500}
        >
          <Text className={`text-lg font-bold ${mood.color}`}>
            {mood.value}
          </Text>
          <Text
            className={`text-xs font-medium ${mood.color} text-center px-1 mt-1`}
            numberOfLines={2}
          >
            {mood.description}
          </Text>
        </HapticTab>
      ))}
    </View>
  );
};
