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
  // Pre-compute mood data to avoid accessing .value during render
  const moodData = React.useMemo(() => {
    return moodScale.map((mood) => ({
      value: mood.value,
      label: mood.label,
      color: mood.color,
      bg: mood.bg,
    }));
  }, []);

  const firstMood = moodData[0];
  const secondRowMoods = moodData.slice(1, 4);
  const thirdRowMoods = moodData.slice(4, 8);
  const fourthRowMoods = moodData.slice(8);

  return (
    <View className="flex-row flex-wrap justify-between mb-2">
      <View className="w-full flex-row justify-between mb-3">
        {/* Include 0 button with the first row in compact mode */}
        <HapticTab
          key={firstMood.value}
          className={`items-center justify-center h-20 rounded-2xl shadow-sm ${firstMood.bg} border border-black/5 dark:border-white/10`}
          style={{ width: "23%" }}
          onPress={() => onMoodPress(firstMood.value)}
          onLongPress={() => onLongPress(firstMood.value)}
          delayLongPress={500}
        >
          <Text className={`text-2xl font-extrabold ${firstMood.color}`}>
            {firstMood.value}
          </Text>
          <Text className={`text-[10px] font-bold uppercase tracking-wider ${firstMood.color} text-center`} numberOfLines={2}>
            {firstMood.label}
          </Text>
        </HapticTab>

        {secondRowMoods.map((mood) => (
          <HapticTab
            key={mood.value}
            className={`items-center justify-center h-20 rounded-2xl shadow-sm ${mood.bg} border border-black/5 dark:border-white/10`}
            style={{ width: "23%" }}
            onPress={() => onMoodPress(mood.value)}
            onLongPress={() => onLongPress(mood.value)}
            delayLongPress={500}
          >
            <Text className={`text-2xl font-extrabold ${mood.color}`}>
              {mood.value}
            </Text>
            <Text className={`text-[10px] font-bold uppercase tracking-wider ${mood.color} text-center`} numberOfLines={2}>
                {mood.label}
            </Text>
          </HapticTab>
        ))}
      </View>

      <View className="w-full flex-row justify-between mb-3">
        {thirdRowMoods.map((mood) => (
          <HapticTab
            key={mood.value}
            className={`items-center justify-center h-20 rounded-2xl shadow-sm ${mood.bg} border border-black/5 dark:border-white/10`}
            style={{ width: "23%" }}
            onPress={() => onMoodPress(mood.value)}
            onLongPress={() => onLongPress(mood.value)}
            delayLongPress={500}
          >
            <Text className={`text-2xl font-extrabold ${mood.color}`}>
              {mood.value}
            </Text>
            <Text className={`text-[10px] font-bold uppercase tracking-wider ${mood.color} text-center`} numberOfLines={2}>{mood.label}</Text>
          </HapticTab>
        ))}
      </View>

      <View className="w-full flex-row justify-between">
        {fourthRowMoods.map((mood) => (
          <HapticTab
            key={mood.value}
            className={`items-center justify-center h-20 rounded-2xl shadow-sm ${mood.bg} border border-black/5 dark:border-white/10`}
            style={{ width: "23%" }}
            onPress={() => onMoodPress(mood.value)}
            onLongPress={() => onLongPress(mood.value)}
            delayLongPress={500}
          >
            <Text className={`text-2xl font-extrabold ${mood.color}`}>
              {mood.value}
            </Text>
            <Text className={`text-[10px] font-bold uppercase tracking-wider ${mood.color} text-center`} numberOfLines={2}>{mood.label}</Text>
          </HapticTab>
        ))}
      </View>
    </View>
  );
};
