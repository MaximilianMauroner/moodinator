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
  const moodData = React.useMemo(() => {
    return moodScale.map((mood) => ({
      value: mood.value,
      label: mood.label,
      description: mood.description,
      color: mood.color,
      bg: mood.bg,
      borderColor: mood.borderColor,
      textHex: mood.textHex,
      bgHex: mood.bgHex,
    }));
  }, []);

  const firstMood = moodData[0];
  const middleMoods = moodData.slice(1, 6);
  const lastMoods = moodData.slice(6);

  return (
    <View className="mb-4">
      {/* Soft header */}
      <View className="flex-row items-center justify-center mb-4">
        <View className="h-px flex-1 bg-slate-200" />
        <Text className="text-xs font-medium text-slate-400 mx-3 tracking-wide">
          How are you feeling? (Detailed)
        </Text>
        <View className="h-px flex-1 bg-slate-200" />
      </View>

      <View className="flex-row flex-wrap justify-between gap-2">
        {/* Featured mood (full width) */}
        <HapticTab
          key={firstMood.value}
          className="items-center justify-center h-20 rounded-2xl w-full"
          style={{
            backgroundColor: firstMood.bgHex || "#F1F5F9",
            shadowColor: firstMood.textHex || "#64748B",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 4,
          }}
          onPress={() => onMoodPress(firstMood.value)}
          onLongPress={() => onLongPress(firstMood.value)}
          delayLongPress={500}
        >
          <View className="flex-row items-center px-5">
            <Text
              className="text-3xl font-bold mr-4"
              style={{ color: firstMood.textHex || "#64748B" }}
            >
              {firstMood.value}
            </Text>
            <View className="flex-1">
              <Text
                className="text-base font-semibold"
                style={{ color: firstMood.textHex || "#64748B" }}
              >
                {firstMood.label}
              </Text>
              <Text
                className="text-xs mt-0.5"
                style={{ color: firstMood.textHex || "#64748B", opacity: 0.7 }}
                numberOfLines={1}
              >
                {firstMood.description}
              </Text>
            </View>
          </View>
        </HapticTab>

        {/* Middle moods (two columns) */}
        {middleMoods.map((mood) => (
          <HapticTab
            key={mood.value}
            className="items-center justify-center h-28 rounded-2xl"
            style={{
              width: "48%",
              backgroundColor: mood.bgHex || "#F1F5F9",
              shadowColor: mood.textHex || "#64748B",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 4,
            }}
            onPress={() => onMoodPress(mood.value)}
            onLongPress={() => onLongPress(mood.value)}
            delayLongPress={500}
          >
            <Text
              className="text-2xl font-bold mb-1"
              style={{ color: mood.textHex || "#64748B" }}
            >
              {mood.value}
            </Text>
            <Text
              className="text-xs font-semibold mb-0.5"
              style={{ color: mood.textHex || "#64748B" }}
            >
              {mood.label}
            </Text>
            <Text
              className="text-[10px] text-center px-3 leading-tight"
              style={{ color: mood.textHex || "#64748B", opacity: 0.7 }}
              numberOfLines={2}
            >
              {mood.description}
            </Text>
          </HapticTab>
        ))}

        {/* Last moods */}
        {lastMoods.map((mood) => (
          <HapticTab
            key={mood.value}
            className="items-center justify-center h-28 rounded-2xl"
            style={{
              width: "48%",
              backgroundColor: mood.bgHex || "#F1F5F9",
              shadowColor: mood.textHex || "#64748B",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 4,
            }}
            onPress={() => onMoodPress(mood.value)}
            onLongPress={() => onLongPress(mood.value)}
            delayLongPress={500}
          >
            <Text
              className="text-2xl font-bold mb-1"
              style={{ color: mood.textHex || "#64748B" }}
            >
              {mood.value}
            </Text>
            <Text
              className="text-xs font-semibold mb-0.5"
              style={{ color: mood.textHex || "#64748B" }}
            >
              {mood.label}
            </Text>
            <Text
              className="text-[10px] text-center px-3 leading-tight"
              style={{ color: mood.textHex || "#64748B", opacity: 0.7 }}
              numberOfLines={2}
            >
              {mood.description}
            </Text>
          </HapticTab>
        ))}
      </View>

      {/* Gentle scale indicator */}
      <View className="mt-4 mx-2">
        <View className="flex-row h-1.5 rounded-full overflow-hidden bg-slate-100">
          <View className="flex-1 bg-violet-300" />
          <View className="flex-1 bg-indigo-300" />
          <View className="flex-1 bg-sky-300" />
          <View className="flex-1 bg-teal-300" />
          <View className="flex-1 bg-emerald-300" />
          <View className="flex-1 bg-slate-300" />
          <View className="flex-1 bg-amber-300" />
          <View className="flex-1 bg-orange-300" />
          <View className="flex-1 bg-rose-300" />
          <View className="flex-1 bg-red-300" />
        </View>
        <View className="flex-row justify-between mt-1.5 px-1">
          <Text className="text-[10px] font-medium text-emerald-500">
            Great
          </Text>
          <Text className="text-[10px] font-medium text-rose-400">
            Need support
          </Text>
        </View>
      </View>
    </View>
  );
};
