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
  // Pre-compute mood data to avoid accessing .value during render
  const moodData = React.useMemo(() => {
    return moodScale.map((mood) => ({
      value: mood.value,
      label: mood.label,
      description: mood.description,
      color: mood.color,
      bg: mood.bg,
    }));
  }, []);

  const firstMood = moodData[0];
  const middleMoods = moodData.slice(1, 6);
  const lastMoods = moodData.slice(6);

  return (
    <View className="flex-row flex-wrap justify-between mb-2">
      {/* Zero button (full width) */}
      <HapticTab
        key={firstMood.value}
        className={`items-center justify-center h-20 rounded-lg shadow-sm ${firstMood.bg} mb-2 w-full`}
        onPress={() => onMoodPress(firstMood.value)}
        onLongPress={() => onLongPress(firstMood.value)}
        delayLongPress={500}
      >
        <Text className={`text-lg font-bold ${firstMood.color}`}>
          {firstMood.value}
        </Text>
        <Text
          className={`text-xs font-medium ${firstMood.color} text-center px-1 mt-1`}
          numberOfLines={2}
        >
          {firstMood.description}
        </Text>
      </HapticTab>

      {/* Remaining buttons (two columns) */}
      {middleMoods.map((mood) => (
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

      {lastMoods.map((mood) => (
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
