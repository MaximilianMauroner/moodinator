import React from "react";
import { View, Text } from "react-native";
import { HapticTab } from "./HapticTab";
import { moodScale } from "@/constants/moodScale";
import { useColorScheme } from "@/hooks/useColorScheme";

interface MoodButtonsCompactProps {
  onMoodPress: (mood: number) => void;
  onLongPress: (mood: number) => void;
}

export const MoodButtonsCompact: React.FC<MoodButtonsCompactProps> = ({
  onMoodPress,
  onLongPress,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const moodData = React.useMemo(() => {
    return moodScale.map((mood) => ({
      value: mood.value,
      label: mood.label,
      color: mood.color,
      bg: mood.bg,
      borderColor: mood.borderColor,
      bgHex: isDark ? mood.bgHexDark : mood.bgHex,
      textHex: isDark ? mood.textHexDark : mood.textHex,
    }));
  }, [isDark]);

  const firstRowMoods = moodData.slice(0, 4);
  const secondRowMoods = moodData.slice(4, 8);
  const thirdRowMoods = moodData.slice(8);

  const renderMoodButton = (mood: typeof moodData[0]) => (
    <HapticTab
      key={mood.value}
      className="flex-1 items-center justify-center py-3.5 mx-1 rounded-2xl"
      style={{
        backgroundColor: mood.bgHex || (isDark ? "#2A2520" : "#F5F1E8"),
        shadowColor: isDark ? "#000" : mood.textHex || "#9D8660",
        shadowOffset: { width: 0, height: isDark ? 2 : 4 },
        shadowOpacity: isDark ? 0.3 : 0.12,
        shadowRadius: isDark ? 4 : 8,
        elevation: 4,
      }}
      onPress={() => onMoodPress(mood.value)}
      onLongPress={() => onLongPress(mood.value)}
      delayLongPress={500}
    >
      <Text
        className="text-2xl font-bold mb-0.5"
        style={{
          color: mood.textHex || (isDark ? "#D4C4A0" : "#9D8660"),
          fontVariant: ["tabular-nums"],
        }}
      >
        {mood.value}
      </Text>
      <Text
        className="text-[9px] font-semibold text-center tracking-wide"
        style={{ color: mood.textHex || (isDark ? "#D4C4A0" : "#9D8660"), opacity: 0.85 }}
        numberOfLines={1}
      >
        {mood.label}
      </Text>
    </HapticTab>
  );

  return (
    <View className="mb-4">
      {/* Organic divider with question */}
      <View className="flex-row items-center justify-center mb-4">
        <View
          className="h-px flex-1"
          style={{
            backgroundColor: isDark ? "#3D352A" : "#E5D9BF",
          }}
        />
        <Text
          className="text-xs font-medium mx-4 tracking-wide"
          style={{ color: isDark ? "#BDA77D" : "#9D8660" }}
        >
          How are you feeling?
        </Text>
        <View
          className="h-px flex-1"
          style={{
            backgroundColor: isDark ? "#3D352A" : "#E5D9BF",
          }}
        />
      </View>

      {/* Button grid */}
      <View className="gap-2.5">
        <View className="flex-row">
          {firstRowMoods.map(renderMoodButton)}
        </View>
        <View className="flex-row">
          {secondRowMoods.map(renderMoodButton)}
        </View>
        <View className="flex-row">
          {thirdRowMoods.map(renderMoodButton)}
        </View>
      </View>

      {/* Organic gradient scale */}
      <View className="mt-4 mx-2">
        <View
          className="flex-row h-1 rounded-full overflow-hidden"
          style={{ backgroundColor: isDark ? "#2A2520" : "#F5F1E8" }}
        >
          <View className="flex-1" style={{ backgroundColor: "#5B8A5B" }} />
          <View className="flex-1" style={{ backgroundColor: "#7BA87B" }} />
          <View className="flex-1" style={{ backgroundColor: "#A8C5A8" }} />
          <View className="flex-1" style={{ backgroundColor: "#847596" }} />
          <View className="flex-1" style={{ backgroundColor: "#A396B3" }} />
          <View className="flex-1" style={{ backgroundColor: "#BDA77D" }} />
          <View className="flex-1" style={{ backgroundColor: "#D4A574" }} />
          <View className="flex-1" style={{ backgroundColor: "#E08B5A" }} />
          <View className="flex-1" style={{ backgroundColor: "#E06B55" }} />
          <View className="flex-1" style={{ backgroundColor: "#C75441" }} />
        </View>
        <View className="flex-row justify-between mt-2 px-0.5">
          <Text
            className="text-[10px] font-medium"
            style={{ color: isDark ? "#7BA87B" : "#5B8A5B" }}
          >
            Great
          </Text>
          <Text
            className="text-[10px] font-medium"
            style={{ color: isDark ? "#ED8370" : "#C75441" }}
          >
            Need support
          </Text>
        </View>
      </View>
    </View>
  );
};
