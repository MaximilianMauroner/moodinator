import React, { memo } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { BUTTON_HINTS } from "@/constants/accessibility";

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
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View className={`p-4 ${!isLast ? "border-b border-paper-200 dark:border-paper-800" : ""}`}>
      <Text className="text-base font-medium mb-1 text-paper-800 dark:text-paper-200">
        {title}
      </Text>
      <Text className="text-sm mb-3 text-sand-500 dark:text-sand-800">
        {description}
      </Text>

      <View className="flex-row gap-2 mb-4">
        <TextInput
          value={newValue}
          onChangeText={onChangeNewValue}
          placeholder={placeholder}
          placeholderTextColor={isDark ? "#6B5C4A" : "#BDA77D"}
          className="flex-1 rounded-xl px-4 py-2.5 bg-paper-200 dark:bg-paper-800 text-paper-800 dark:text-paper-200 border border-sand-300 dark:border-sand-800"
          blurOnSubmit={false}
          returnKeyType="done"
          onSubmitEditing={onAdd}
          accessibilityLabel={`Add new ${title.toLowerCase()}`}
          accessibilityHint={`Enter a new ${title.toLowerCase()} and press add`}
        />
        <TouchableOpacity
          onPress={onAdd}
          className="w-12 h-12 rounded-xl items-center justify-center bg-sage-500 dark:bg-sage-600"
          accessibilityRole="button"
          accessibilityLabel={`Add ${title.toLowerCase()}`}
          accessibilityHint={BUTTON_HINTS.add}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {items.map((item) => (
          <TouchableOpacity
            key={item}
            onPress={() => onRemove(item)}
            className="flex-row items-center rounded-full pl-3 pr-2 py-1.5 bg-paper-200 dark:bg-paper-800 border border-sand-300 dark:border-sand-800"
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item}`}
            accessibilityHint="Tap to remove this item"
          >
            <Text className="text-sm font-medium mr-1 text-sand-600 dark:text-sand-400">
              {item}
            </Text>
            <Ionicons name="close-circle" size={16} color={isDark ? "#6B5C4A" : "#BDA77D"} />
          </TouchableOpacity>
        ))}
        {items.length === 0 && (
          <Text className="text-sm italic p-1 text-sand-500 dark:text-sand-800">
            No items added yet.
          </Text>
        )}
      </View>
    </View>
  );
});

