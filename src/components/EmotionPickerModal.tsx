import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  SafeAreaView,
  Animated,
  ScrollView,
} from "react-native";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { moodScale } from "@/constants/moodScale";
import { HapticTab } from "./HapticTab";

interface Props {
  visible: boolean;
  moodValue: number;
  emotions: string[];
  commonEmotions?: string[];
  onCancel: () => void;
  onSelectEmotion: (emotion: string | null) => void;
  onSkip: () => void;
}

const COMMON_COUNT = 8;

export const EmotionPickerModal: React.FC<Props> = ({
  visible,
  moodValue,
  emotions,
  commonEmotions,
  onCancel,
  onSelectEmotion,
  onSkip,
}) => {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(300);
    }
  }, [visible]);

  const currentMoodInfo = moodScale.find((m) => m.value === moodValue);

  const common = (commonEmotions && commonEmotions.length > 0)
    ? commonEmotions
    : emotions.slice(0, COMMON_COUNT);
  const rest = emotions.filter((e) => !common.includes(e));

  const renderEmotionButton = (emotion: string, index: number) => {
    const emotionMood = moodScale.find((m) => m.label.toLowerCase() === emotion.toLowerCase());
    const isSelected = emotion.toLowerCase() === currentMoodInfo?.label?.toLowerCase();

    return (
      <HapticTab
        key={`${emotion}-${index}`}
        onPress={() => onSelectEmotion(emotion)}
        className={`mb-3 px-4 py-3 rounded-xl border-2 ${
          isSelected
            ? `${emotionMood?.bg ?? "bg-blue-50"} border-blue-500 dark:border-blue-400`
            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
        }`}
        style={{ width: "48%" }}
      >
        <Text
          className={`text-center font-medium ${
            isSelected
              ? emotionMood?.color ?? "text-blue-700"
              : "text-slate-700 dark:text-slate-300"
          }`}
        >
          {emotion}
        </Text>
      </HapticTab>
    );
  };

  return (
    <SafeAreaView>
      <Modal
        animationType="fade"
        transparent={true}
        visible={visible}
        onRequestClose={onCancel}
        statusBarTranslucent
      >
        <View className="flex-1 justify-center items-center bg-black/60 px-4">
          <Animated.View
            style={{ transform: [{ translateY: slideAnim }], width: "100%" }}
          >
            <View className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[80%]">
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-1">
                  <Text className="text-xl font-bold text-blue-800 dark:text-blue-200 text-center">
                    Select Emotion
                  </Text>
                  {currentMoodInfo && (
                    <Text className="text-sm text-gray-500 dark:text-slate-400 text-center mt-1">
                      Mood {moodValue}: {currentMoodInfo.label}
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={onCancel}
                  className="p-2 rounded-full active:bg-gray-100 dark:active:bg-slate-700 ml-2"
                >
                  <IconSymbol name="xmark" size={20} color="#6b7280" />
                </Pressable>
              </View>

              {/* Common emotions section */}
              <View className="mb-2">
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Common
                </Text>
                <View className="flex-row flex-wrap justify-between">
                  {common.map(renderEmotionButton)}
                </View>
              </View>

              {/* Rest in scroll */}
              <ScrollView className="max-h-96 mb-4" showsVerticalScrollIndicator={true}>
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  All emotions
                </Text>
                <View className="flex-row flex-wrap justify-between">
                  {rest.map(renderEmotionButton)}
                </View>
              </ScrollView>

              <View className="flex-row justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                <HapticTab
                  onPress={onSkip}
                  className="flex-row items-center bg-gray-100 dark:bg-slate-800 px-4 py-3 rounded-xl active:bg-gray-200 dark:active:bg-slate-700"
                  style={{ flex: 1, marginRight: 8 }}
                >
                  <IconSymbol
                    name="arrow.right"
                    size={16}
                    color="#6b7280"
                    style={{ marginRight: 6 }}
                  />
                  <Text className="text-gray-700 dark:text-slate-200 font-medium">
                    Skip
                  </Text>
                </HapticTab>
                <HapticTab
                  onPress={onCancel}
                  className="flex-row items-center bg-gray-100 dark:bg-slate-800 px-4 py-3 rounded-xl active:bg-gray-200 dark:active:bg-slate-700"
                  style={{ flex: 1, marginLeft: 8 }}
                >
                  <IconSymbol
                    name="xmark"
                    size={16}
                    color="#6b7280"
                    style={{ marginRight: 6 }}
                  />
                  <Text className="text-gray-700 dark:text-slate-200 font-medium">
                    Cancel
                  </Text>
                </HapticTab>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

