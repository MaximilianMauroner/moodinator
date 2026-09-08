import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { MoodHistoryFilters } from "@/services/moodService";
import { useEntrySettings } from "@/hooks/useEntrySettings";
import { useMoodsStore } from "@/shared/state/moodsStore";

function dateText(value?: number) {
  if (value === undefined) return "";
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(text: string, end: boolean): number | undefined {
  if (!text.trim()) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!match) throw new Error("Use YYYY-MM-DD for dates.");
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    throw new Error("Enter a valid date.");
  if (end) date.setHours(23, 59, 59, 999);
  return date.getTime();
}

function FilterChoices({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (names: string[]) => void;
}) {
  const [otherName, setOtherName] = useState("");
  const choices = [...new Set([...options, ...selected])];
  const toggle = (name: string) => {
    onChange(
      selected.includes(name)
        ? selected.filter((value) => value !== name)
        : [...selected, name],
    );
  };
  const add = () => {
    const name = otherName.trim();
    if (name && !selected.includes(name)) onChange([...selected, name]);
    setOtherName("");
  };
  return (
    <View>
      <Text className="mb-2 text-paper-900 dark:text-paper-100">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {choices.map((name) => (
          <Pressable
            key={name}
            accessibilityRole="checkbox"
            accessibilityLabel={`${label}: ${name}`}
            accessibilityState={{ checked: selected.includes(name) }}
            onPress={() => toggle(name)}
            className={
              selected.includes(name)
                ? "rounded-full bg-sage-600 px-3 py-2"
                : "rounded-full border border-paper-300 px-3 py-2"
            }
          >
            <Text
              className={
                selected.includes(name)
                  ? "text-white"
                  : "text-paper-900 dark:text-paper-100"
              }
            >
              {name}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text className="mt-3 mb-1 text-sm text-paper-700 dark:text-paper-300">
        Missing a name from older entries? Add its exact name.
      </Text>
      <TextInput
        accessibilityLabel={`Other ${label.toLowerCase()} name`}
        value={otherName}
        onChangeText={setOtherName}
        onSubmitEditing={add}
        autoCapitalize="none"
        className="rounded-xl border border-paper-300 p-3 text-paper-900 dark:text-paper-100"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${label.toLowerCase()} filter`}
        onPress={add}
        className="py-3"
      >
        <Text className="text-sage-700 dark:text-sage-300">Add name</Text>
      </Pressable>
    </View>
  );
}

export function HistoryFilterSheet() {
  const { emotionOptions, contextOptions } = useEntrySettings();
  const filters = useMoodsStore((state) => state.filters);
  const setFilters = useMoodsStore((state) => state.setFilters);
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [emotions, setEmotions] = useState<string[]>([]);
  const [contexts, setContexts] = useState<string[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");
  const open = () => {
    setText(filters.text ?? "");
    setMin(filters.minMood?.toString() ?? "");
    setMax(filters.maxMood?.toString() ?? "");
    setEmotions(filters.emotions ?? []);
    setContexts(filters.contexts ?? []);
    setStart(dateText(filters.startDate));
    setEnd(dateText(filters.endDate));
    setError("");
    setVisible(true);
  };
  const apply = () => {
    try {
      const minMood = min.trim() ? Number(min) : undefined;
      const maxMood = max.trim() ? Number(max) : undefined;
      if (
        [minMood, maxMood].some(
          (value) =>
            value !== undefined &&
            (!Number.isInteger(value) || value < 0 || value > 10),
        )
      )
        throw new Error("Mood bounds must be whole numbers from 0 to 10.");
      if (minMood !== undefined && maxMood !== undefined && minMood > maxMood)
        throw new Error("The lower mood bound must come first.");
      const startDate = parseDate(start, false);
      const endDate = parseDate(end, true);
      if (
        startDate !== undefined &&
        endDate !== undefined &&
        startDate > endDate
      )
        throw new Error("The start date must come first.");
      const next: MoodHistoryFilters = {};
      if (text.trim()) next.text = text.trim();
      if (minMood !== undefined) next.minMood = minMood;
      if (maxMood !== undefined) next.maxMood = maxMood;
      if (emotions.length) next.emotions = emotions;
      if (contexts.length) next.contexts = contexts;
      if (startDate !== undefined) next.startDate = startDate;
      if (endDate !== undefined) next.endDate = endDate;
      void setFilters(next);
      setVisible(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check your filters.");
    }
  };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Filter history"
        onPress={open}
        className="flex-row items-center gap-2 px-3 py-2"
      >
        <Ionicons name="filter" size={20} color="#5B8A5B" />
        <Text className="text-sage-700 dark:text-sage-300">
          {Object.keys(filters).length ? "Filters active" : "Filter"}
        </Text>
      </Pressable>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900">
          <ScrollView
            contentContainerStyle={{ padding: 24, gap: 14 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="text-xl font-semibold text-paper-900 dark:text-paper-100">
              Filter history
            </Text>
            <Text className="text-paper-700 dark:text-paper-300">
              Lower mood scores are better. For mood 7 or worse, set the lower
              bound to 7. All selected filters must match.
            </Text>
            {(
              [
                ["Note contains", text, setText],
                ["Mood lower bound (0–10)", min, setMin],
                ["Mood upper bound (0–10)", max, setMax],
                ["From date (YYYY-MM-DD)", start, setStart],
                ["Through date (YYYY-MM-DD)", end, setEnd],
              ] as const
            ).map(([label, value, onChangeText]) => (
              <View key={label}>
                <Text className="mb-1 text-paper-900 dark:text-paper-100">
                  {label}
                </Text>
                <TextInput
                  accessibilityLabel={label}
                  value={value}
                  onChangeText={onChangeText}
                  autoCapitalize="none"
                  className="rounded-xl border border-paper-300 p-3 text-paper-900 dark:text-paper-100"
                />
              </View>
            ))}
            <FilterChoices
              label="Emotions"
              options={emotionOptions.map((emotion) => emotion.name)}
              selected={emotions}
              onChange={setEmotions}
            />
            <FilterChoices
              label="Contexts"
              options={contextOptions}
              selected={contexts}
              onChange={setContexts}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const now = new Date();
                setStart(`${now.getFullYear()}-01-01`);
                setEnd(`${now.getFullYear()}-12-31`);
              }}
            >
              <Text className="text-sage-700 dark:text-sage-300">
                Use this year
              </Text>
            </Pressable>
            {error ? (
              <Text accessibilityRole="alert" className="text-red-600">
                {error}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={apply}
              className="rounded-xl bg-sage-600 p-4"
            >
              <Text className="text-center text-white">Apply filters</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void setFilters({});
                setVisible(false);
              }}
              className="p-3"
            >
              <Text className="text-center text-paper-900 dark:text-paper-100">
                Clear filters
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setVisible(false)}
              className="p-3"
            >
              <Text className="text-center text-paper-900 dark:text-paper-100">
                Cancel
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
