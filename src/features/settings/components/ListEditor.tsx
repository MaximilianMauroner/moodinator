import React, { memo } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export const ListEditor = memo(function ListEditor({
  title,
  description,
  placeholder,
  items,
  newValue,
  onChangeNewValue,
  onAdd,
  onRemove,
  isLast,
}: {
  title: string;
  description: string;
  placeholder: string;
  items: string[];
  newValue: string;
  onChangeNewValue: (value: string) => void;
  onAdd: () => void;
  onRemove: (value: string) => void;
  isLast?: boolean;
}) {
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

      <View className="flex-row gap-2 mb-4">
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

      <View className="flex-row flex-wrap gap-2">
        {items.map((item) => (
          <TouchableOpacity
            key={item}
            onPress={() => onRemove(item)}
            className="flex-row items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full pl-3 pr-2 py-1.5"
          >
            <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mr-1">
              {item}
            </Text>
            <Ionicons name="close-circle" size={16} color="#94a3b8" />
          </TouchableOpacity>
        ))}
        {items.length === 0 && (
          <Text className="text-sm text-slate-400 italic p-1">
            No items added yet.
          </Text>
        )}
      </View>
    </View>
  );
});

