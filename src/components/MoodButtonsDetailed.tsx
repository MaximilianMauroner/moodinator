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
    <View className="flex-row flex-wrap justify-between">
      {/* Zero button (full width) */}
      <HapticTab
        key={firstMood.value}
        className={`items-center justify-center h-20 rounded-2xl shadow-sm ${firstMood.bg} mb-3 w-full border border-black/5 dark:border-white/10`}
        onPress={() => onMoodPress(firstMood.value)}
        onLongPress={() => onLongPress(firstMood.value)}
        delayLongPress={500}
      >
        <View className="flex-row items-center space-x-3">
            <Text className={`text-2xl font-extrabold ${firstMood.color}`}>
            {firstMood.value}
            </Text>
            <Text
            className={`text-sm font-semibold ${firstMood.color} text-center flex-1`}
            numberOfLines={1}
            >
            {firstMood.description}
            </Text>
        </View>
      </HapticTab>

      {/* Remaining buttons (two columns) */}
      {middleMoods.map((mood) => (
        <HapticTab
          key={mood.value}
          className={`items-center justify-center h-28 rounded-2xl shadow-sm ${mood.bg} mb-3 border border-black/5 dark:border-white/10`}
          style={{ width: "48%" }}
          onPress={() => onMoodPress(mood.value)}
          onLongPress={() => onLongPress(mood.value)}
          delayLongPress={500}
        >
          <Text className={`text-3xl font-extrabold ${mood.color} mb-1`}>
            {mood.value}
          </Text>
          <Text
            className={`text-xs font-semibold ${mood.color} text-center px-2 leading-tight`}
            numberOfLines={2}
          >
            {mood.description}
          </Text>
        </HapticTab>
      ))}

      {lastMoods.map((mood) => (
        <HapticTab
          key={mood.value}
          className={`items-center justify-center h-28 rounded-2xl shadow-sm ${mood.bg} mb-3 border border-black/5 dark:border-white/10`}
          style={{ width: "48%" }}
          onPress={() => onMoodPress(mood.value)}
          onLongPress={() => onLongPress(mood.value)}
          delayLongPress={500}
        >
          <Text className={`text-3xl font-extrabold ${mood.color} mb-1`}>
            {mood.value}
          </Text>
          <Text
            className={`text-xs font-semibold ${mood.color} text-center px-2 leading-tight`}
            numberOfLines={2}
          >
            {mood.description}
          </Text>
        </HapticTab>
      ))}
    </View>
  );
};
