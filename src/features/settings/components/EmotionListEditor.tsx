import React, { memo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Emotion } from "@db/types";
import { BUTTON_HINTS } from "@/constants/accessibility";
import { useThemeColors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";

const CATEGORY_OPTIONS: { value: Emotion["category"]; label: string }[] = [
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
];

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
  const { get, getCategoryStyles } = useThemeColors();
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const categoryStyles = getCategoryStyles();

  const categoryLabel = (category: Emotion["category"]) =>
    CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? "Neutral";

  const handleAdd = () => {
    haptics.light();
    onAdd();
  };

  const handleRemove = (name: string) => {
    haptics.light();
    onRemove(name);
  };

  const handleCategoryChange = (category: Emotion["category"]) => {
    haptics.light();
    onChangeNewCategory(category);
  };

  const handleUpdateCategory = (name: string, category: Emotion["category"]) => {
    haptics.light();
    onUpdateCategory(name, category);
  };

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
          placeholderTextColor={get("textMuted")}
          className="flex-1 rounded-xl px-4 py-2.5 bg-paper-200 dark:bg-paper-800 text-paper-800 dark:text-paper-200 border border-sand-300 dark:border-sand-800"
          blurOnSubmit={false}
          returnKeyType="done"
          onSubmitEditing={handleAdd}
          accessibilityLabel="Add new emotion"
          accessibilityHint="Enter a new emotion name and press add"
        />
        <TouchableOpacity
          onPress={handleAdd}
          className="w-12 h-12 rounded-xl items-center justify-center bg-sage-500 dark:bg-sage-600"
          accessibilityRole="button"
          accessibilityLabel="Add emotion"
          accessibilityHint={BUTTON_HINTS.add}
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
              onPress={() => handleCategoryChange(option.value)}
              className="rounded-full px-3 py-1"
              style={{
                ...(isSelected ? styles.active : styles.inactive),
                borderWidth: 1,
              }}
              accessibilityRole="button"
              accessibilityLabel={`${option.label} category, ${isSelected ? "selected" : "not selected"}`}
              accessibilityHint={isSelected ? "Currently selected category" : "Tap to select this category"}
              accessibilityState={{ selected: isSelected }}
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
                backgroundColor: get("surfaceAlt"),
                borderWidth: 1,
                borderColor: get("border"),
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 mr-3">
                  <Text
                    className="text-sm font-medium"
                    style={{ color: get("textSubtle") }}
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
                      color={get("textMuted")}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRemove(emotion.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${emotion.name}`}
                    accessibilityHint="Tap to remove this emotion"
                  >
                    <Ionicons name="close-circle" size={18} color={get("textMuted")} />
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
                        onPress={() => handleUpdateCategory(emotion.name, option.value)}
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
