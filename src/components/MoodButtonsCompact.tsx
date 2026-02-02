import React from "react";
import { View, Text } from "react-native";
import { HapticTab } from "./HapticTab";
import { moodScale } from "@/constants/moodScale";
import { useThemeColors, colors } from "@/constants/colors";
import { getMoodButtonLabel, getMoodButtonHint } from "@/constants/accessibility";

interface MoodButtonsCompactProps {
  onMoodPress: (mood: number) => void;
  onLongPress: (mood: number) => void;
}

export const MoodButtonsCompact: React.FC<MoodButtonsCompactProps> = ({
  onMoodPress,
  onLongPress,
}) => {
  const { isDark, get } = useThemeColors();

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
        backgroundColor: mood.bgHex || get("surfaceAlt"),
        shadowColor: isDark ? "#000" : mood.textHex || colors.sand.text.light,
        shadowOffset: { width: 0, height: isDark ? 2 : 4 },
        shadowOpacity: isDark ? 0.3 : 0.12,
        shadowRadius: isDark ? 4 : 8,
        elevation: 4,
      }}
      onPress={() => onMoodPress(mood.value)}
      onLongPress={() => onLongPress(mood.value)}
      delayLongPress={500}
      accessibilityRole="button"
      accessibilityLabel={getMoodButtonLabel(mood.value, mood.label)}
      accessibilityHint={getMoodButtonHint()}
    >
      <Text
        className="text-2xl font-bold mb-0.5"
        style={{
          color: mood.textHex || (isDark ? colors.sand.text.dark : colors.sand.text.light),
          fontVariant: ["tabular-nums"],
        }}
      >
        {mood.value}
      </Text>
      <Text
        className="text-[9px] font-semibold text-center tracking-wide"
        style={{ color: mood.textHex || (isDark ? colors.sand.text.dark : colors.sand.text.light), opacity: 0.85 }}
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
          style={{ backgroundColor: get("border") }}
        />
        <Text
          className="text-xs font-medium mx-4 tracking-wide"
          style={{ color: isDark ? colors.sand.textMuted.dark : "#6B5C4A" }}
        >
          How are you feeling?
        </Text>
        <View
          className="h-px flex-1"
          style={{ backgroundColor: get("border") }}
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
          style={{ backgroundColor: get("surfaceAlt") }}
        >
          {colors.moodGradient.map((color, index) => (
            <View key={index} className="flex-1" style={{ backgroundColor: color }} />
          ))}
        </View>
        <View className="flex-row justify-between mt-2 px-0.5">
          <Text
            className="text-[10px] font-medium"
            style={{ color: isDark ? colors.primaryMuted.dark : colors.primary.light }}
          >
            Great
          </Text>
          <Text
            className="text-[10px] font-medium"
            style={{ color: isDark ? colors.negative.text.dark : colors.negative.text.light }}
          >
            Need support
          </Text>
        </View>
      </View>
    </View>
  );
};
