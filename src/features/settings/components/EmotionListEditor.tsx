import React, { memo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Emotion } from "@db/types";

const CATEGORY_OPTIONS: { value: Emotion["category"]; label: string }[] = [
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
];

const CATEGORY_STYLES: Record<Emotion["category"], { active: string; inactive: string }> =
  {
    positive: {
      active: "bg-emerald-100 border-emerald-200 text-emerald-700",
      inactive: "bg-slate-100 border-slate-200 text-slate-500",
    },
    neutral: {
      active: "bg-amber-100 border-amber-200 text-amber-700",
      inactive: "bg-slate-100 border-slate-200 text-slate-500",
    },
    negative: {
      active: "bg-rose-100 border-rose-200 text-rose-700",
      inactive: "bg-slate-100 border-slate-200 text-slate-500",
    },
  };

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
  const [expandedName, setExpandedName] = useState<string | null>(null);

  const categoryLabel = (category: Emotion["category"]) =>
    CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? "Neutral";

  return (
    <View
      className={`p-4 ${
        !isLast ? "border-b border-slate-100 dark:border-slate-800" : ""
      }`}
    >
      <Text className="text-base font-medium text-slate-900 dark:text-slate-100 mb-1">
        {title}
      </Text>
      <Text className="text-sm text-slate-500 dark:text-slate-400 mb-3">
        {description}
      </Text>

      <View className="flex-row gap-2 mb-3">
        <TextInput
          value={newValue}
          onChangeText={onChangeNewValue}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 border border-transparent focus:border-blue-500 transition-colors"
          blurOnSubmit={false}
          returnKeyType="done"
          onSubmitEditing={onAdd}
        />
        <TouchableOpacity
          onPress={onAdd}
          className="bg-blue-600 w-12 h-12 rounded-xl items-center justify-center active:bg-blue-700"
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View className="flex-row flex-wrap gap-2 mb-4">
        {CATEGORY_OPTIONS.map((option) => {
          const isSelected = option.value === newCategory;
          const classes = isSelected
            ? CATEGORY_STYLES[option.value].active
            : CATEGORY_STYLES[option.value].inactive;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => onChangeNewCategory(option.value)}
              className={`border rounded-full px-3 py-1 ${classes}`}
            >
              <Text className="text-xs font-semibold">{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View className="gap-2">
        {emotions.map((emotion) => (
          <View
            key={emotion.name}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 mr-3">
                <Text
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
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
                  className={`flex-row items-center gap-1 border rounded-full px-2 py-1 ${CATEGORY_STYLES[emotion.category].active}`}
                >
                  <Text className="text-[11px] font-semibold">
                    {categoryLabel(emotion.category)}
                  </Text>
                  <Ionicons
                    name={expandedName === emotion.name ? "chevron-up" : "chevron-down"}
                    size={12}
                    color="#94a3b8"
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onRemove(emotion.name)}>
                  <Ionicons name="close-circle" size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>
            {expandedName === emotion.name && (
              <View className="flex-row flex-wrap gap-2 mt-2">
                {CATEGORY_OPTIONS.map((option) => {
                  const isSelected = option.value === emotion.category;
                  const classes = isSelected
                    ? CATEGORY_STYLES[option.value].active
                    : CATEGORY_STYLES[option.value].inactive;
                  return (
                    <TouchableOpacity
                      key={`${emotion.name}-${option.value}`}
                      onPress={() => onUpdateCategory(emotion.name, option.value)}
                      className={`border rounded-full px-2 py-1 ${classes}`}
                    >
                      <Text className="text-[11px] font-semibold">
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        ))}
        {emotions.length === 0 && (
          <Text className="text-sm text-slate-400 italic p-1">
            No emotions added yet.
          </Text>
        )}
      </View>
    </View>
  );
});
