import React, { memo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import type { Emotion } from "@db/types";

const CATEGORY_OPTIONS: { value: Emotion["category"]; label: string }[] = [
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
];

function getCategoryStyles(isDark: boolean) {
  return {
    positive: {
      active: {
        backgroundColor: isDark ? "#2D3D2D" : "#E8EFE8",
        borderColor: isDark ? "#3D4D3D" : "#C8DBC8",
      },
      activeText: isDark ? "#A8C5A8" : "#476D47",
      inactive: {
        backgroundColor: isDark ? "#2A2520" : "#F5F1E8",
        borderColor: isDark ? "#3D352A" : "#E5D9BF",
      },
      inactiveText: isDark ? "#6B5C4A" : "#BDA77D",
    },
    neutral: {
      active: {
        backgroundColor: isDark ? "#3D352A" : "#FDF8EF",
        borderColor: isDark ? "#4D453A" : "#E5D9BF",
      },
      activeText: isDark ? "#D4C5A8" : "#9D8660",
      inactive: {
        backgroundColor: isDark ? "#2A2520" : "#F5F1E8",
        borderColor: isDark ? "#3D352A" : "#E5D9BF",
      },
      inactiveText: isDark ? "#6B5C4A" : "#BDA77D",
    },
    negative: {
      active: {
        backgroundColor: isDark ? "#3D2822" : "#FDE8E4",
        borderColor: isDark ? "#4D3832" : "#F5C4BC",
      },
      activeText: isDark ? "#F5A899" : "#C75441",
      inactive: {
        backgroundColor: isDark ? "#2A2520" : "#F5F1E8",
        borderColor: isDark ? "#3D352A" : "#E5D9BF",
      },
      inactiveText: isDark ? "#6B5C4A" : "#BDA77D",
    },
  };
}

export const EmotionListEditor = memo(function EmotionListEditor({
  title,
  description,
  placeholder,
  emotions,
  newValue,
  newCategory,
  onChangeNewValue,
  onChangeNewCategory,
  onAdd,
  onRemove,
  onUpdateCategory,
  isLast,
}: {
  title: string;
  description: string;
  placeholder: string;
  emotions: Emotion[];
  newValue: string;
  newCategory: Emotion["category"];
  onChangeNewValue: (value: string) => void;
  onChangeNewCategory: (value: Emotion["category"]) => void;
  onAdd: () => void;
  onRemove: (value: string) => void;
  onUpdateCategory: (name: string, category: Emotion["category"]) => void;
  isLast?: boolean;
}) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const categoryStyles = getCategoryStyles(isDark);

  const categoryLabel = (category: Emotion["category"]) =>
    CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? "Neutral";

  return (
    <View className={`p-4 ${!isLast ? "border-b border-paper-200 dark:border-paper-800" : ""}`}>
      <Text className="text-base font-medium mb-1 text-paper-800 dark:text-paper-200">
        {title}
      </Text>
      <Text className="text-sm mb-3 text-sand-500 dark:text-sand-800">
        {description}
      </Text>

      <View className="flex-row gap-2 mb-3">
        <TextInput
          value={newValue}
          onChangeText={onChangeNewValue}
          placeholder={placeholder}
          placeholderTextColor={isDark ? "#6B5C4A" : "#BDA77D"}
          className="flex-1 rounded-xl px-4 py-2.5 bg-paper-200 dark:bg-paper-800 text-paper-800 dark:text-paper-200 border border-sand-300 dark:border-sand-800"
          blurOnSubmit={false}
          returnKeyType="done"
          onSubmitEditing={onAdd}
        />
        <TouchableOpacity
          onPress={onAdd}
          className="w-12 h-12 rounded-xl items-center justify-center bg-sage-500 dark:bg-sage-600"
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View className="flex-row flex-wrap gap-2 mb-4">
        {CATEGORY_OPTIONS.map((option) => {
          const isSelected = option.value === newCategory;
          const styles = categoryStyles[option.value];
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => onChangeNewCategory(option.value)}
              className="rounded-full px-3 py-1"
              style={{
                ...(isSelected ? styles.active : styles.inactive),
                borderWidth: 1,
              }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: isSelected ? styles.activeText : styles.inactiveText }}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View className="gap-2">
        {emotions.map((emotion) => {
          const emotionStyles = categoryStyles[emotion.category];
          return (
            <View
              key={emotion.name}
              className="rounded-2xl px-3 py-2"
              style={{
                backgroundColor: isDark ? "#2A2520" : "#F5F1E8",
                borderWidth: 1,
                borderColor: isDark ? "#3D352A" : "#E5D9BF",
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 mr-3">
                  <Text
                    className="text-sm font-medium"
                    style={{ color: isDark ? "#D4C5A8" : "#5C4D3D" }}
                    numberOfLines={1}
                  >
                    {emotion.name}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() =>
                      setExpandedName((prev) =>
                        prev === emotion.name ? null : emotion.name
                      )
                    }
                    className="flex-row items-center gap-1 rounded-full px-2 py-1"
                    style={{
                      ...emotionStyles.active,
                      borderWidth: 1,
                    }}
                  >
                    <Text
                      className="text-[11px] font-semibold"
                      style={{ color: emotionStyles.activeText }}
                    >
                      {categoryLabel(emotion.category)}
                    </Text>
                    <Ionicons
                      name={expandedName === emotion.name ? "chevron-up" : "chevron-down"}
                      size={12}
                      color={isDark ? "#6B5C4A" : "#BDA77D"}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onRemove(emotion.name)}>
                    <Ionicons name="close-circle" size={18} color={isDark ? "#6B5C4A" : "#BDA77D"} />
                  </TouchableOpacity>
                </View>
              </View>
              {expandedName === emotion.name && (
                <View className="flex-row flex-wrap gap-2 mt-2">
                  {CATEGORY_OPTIONS.map((option) => {
                    const isSelected = option.value === emotion.category;
                    const optStyles = categoryStyles[option.value];
                    return (
                      <TouchableOpacity
                        key={`${emotion.name}-${option.value}`}
                        onPress={() => onUpdateCategory(emotion.name, option.value)}
                        className="rounded-full px-2 py-1"
                        style={{
                          ...(isSelected ? optStyles.active : optStyles.inactive),
                          borderWidth: 1,
                        }}
                      >
                        <Text
                          className="text-[11px] font-semibold"
                          style={{ color: isSelected ? optStyles.activeText : optStyles.inactiveText }}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
        {emotions.length === 0 && (
          <Text className="text-sm italic p-1 text-sand-500 dark:text-sand-800">
            No emotions added yet.
          </Text>
        )}
      </View>
    </View>
  );
});
