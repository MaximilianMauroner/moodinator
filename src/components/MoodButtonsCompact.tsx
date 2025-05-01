import React from "react";
import { View, Text } from "react-native";
import { HapticTab } from "./HapticTab";
import { moodScale } from "@/constants/moodScale";

interface MoodButtonsCompactProps {
  onMoodPress: (mood: number) => void;
  onLongPress: (mood: number) => void;
}

export const MoodButtonsCompact: React.FC<MoodButtonsCompactProps> = ({
  onMoodPress,
  onLongPress,
}) => {
  return (
    <View className="flex-row flex-wrap justify-between mb-2">
      <View className="w-full flex-row justify-between mb-2">
        {/* Include 0 button with the first row in compact mode */}
        <HapticTab
          key={moodScale[0].value}
          className={`items-center justify-center h-16 rounded-lg shadow-sm ${moodScale[0].bg}`}
          style={{ width: "23%" }}
          onPress={() => onMoodPress(moodScale[0].value)}
          onLongPress={() => onLongPress(moodScale[0].value)}
          delayLongPress={500}
        >
          <Text className={`text-lg font-bold ${moodScale[0].color}`}>
            {moodScale[0].value}
          </Text>
        </HapticTab>

        {moodScale.slice(1, 4).map((mood) => (
          <HapticTab
            key={mood.value}
            className={`items-center justify-center h-16 rounded-lg shadow-sm ${mood.bg}`}
            style={{ width: "23%" }}
            onPress={() => onMoodPress(mood.value)}
            onLongPress={() => onLongPress(mood.value)}
            delayLongPress={500}
          >
            <Text className={`text-lg font-bold ${mood.color}`}>
              {mood.value}
            </Text>
          </HapticTab>
        ))}
      </View>

      <View className="w-full flex-row justify-between mb-2">
        {moodScale.slice(4, 8).map((mood) => (
          <HapticTab
            key={mood.value}
            className={`items-center justify-center h-16 rounded-lg shadow-sm ${mood.bg}`}
            style={{ width: "23%" }}
            onPress={() => onMoodPress(mood.value)}
            onLongPress={() => onLongPress(mood.value)}
            delayLongPress={500}
          >
            <Text className={`text-lg font-bold ${mood.color}`}>
              {mood.value}
            </Text>
          </HapticTab>
        ))}
      </View>

      <View className="w-full flex-row justify-between">
        {moodScale.slice(8).map((mood) => (
          <HapticTab
            key={mood.value}
            className={`items-center justify-center h-16 rounded-lg shadow-sm ${mood.bg}`}
            style={{ width: "23%" }}
            onPress={() => onMoodPress(mood.value)}
            onLongPress={() => onLongPress(mood.value)}
            delayLongPress={500}
          >
            <Text className={`text-lg font-bold ${mood.color}`}>
              {mood.value}
            </Text>
          </HapticTab>
        ))}
      </View>
    </View>
  );
};
