import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import {
  getCustomMoodLabels,
  saveCustomMoodLabels,
  resetMoodLabels,
  CustomMoodLabel,
} from "@/lib/entrySettings";

export default function CustomizeMoodLabelsScreen() {
  const router = useRouter();
  const [labels, setLabels] = useState<CustomMoodLabel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLabels();
  }, []);

  const loadLabels = async () => {
    setLoading(true);
    try {
      const customLabels = await getCustomMoodLabels();
      setLabels(customLabels);
    } catch (error) {
      console.error("Failed to load labels:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLabelChange = (value: number, newLabel: string) => {
    setLabels((prev) =>
      prev.map((item) =>
        item.value === value ? { ...item, label: newLabel } : item
      )
    );
  };

  const handleSave = async () => {
    // Validate that no labels are empty
    const hasEmpty = labels.some((item) => item.label.trim() === "");
    if (hasEmpty) {
      Alert.alert("Empty labels", "Please fill in all mood labels.");
      return;
    }

    // Validate label length (max 20 characters recommended for UI layout)
    const hasTooLong = labels.some((item) => item.label.trim().length > 20);
    if (hasTooLong) {
      Alert.alert(
        "Labels too long",
        "Please keep mood labels under 20 characters for better display."
      );
      return;
    }

    try {
      await saveCustomMoodLabels(labels);
      Alert.alert("Success", "Mood labels saved successfully!");
      router.back();
    } catch (error) {
      console.error("Failed to save labels:", error);
      Alert.alert("Error", "Failed to save mood labels.");
    }
  };

  const handleReset = () => {
    Alert.alert(
      "Reset to defaults?",
      "This will restore the original mood labels. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await resetMoodLabels();
            await loadLabels();
            Alert.alert("Reset complete", "Mood labels have been reset to defaults.");
          },
        },
      ]
    );
  };

  const getMoodColor = (value: number) => {
    if (value <= 2) return "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700";
    if (value <= 4) return "bg-cyan-100 dark:bg-cyan-900/30 border-cyan-300 dark:border-cyan-700";
    if (value === 5) return "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700";
    if (value <= 7) return "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700";
    return "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700";
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-slate-950">
        <View className="flex-1 items-center justify-center">
          <Text className="text-slate-500 dark:text-slate-400">Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-950">
      <ScrollView className="flex-1">
        <View className="p-4 space-y-4">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-2">
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm"
            >
              <Text className="text-base font-semibold text-slate-700 dark:text-slate-100">
                Back
              </Text>
            </Pressable>
            <Text className="text-xl font-bold text-slate-900 dark:text-white flex-1 text-center">
              Customize Mood Labels
            </Text>
            <View className="w-[64px]" />
          </View>

          {/* Description */}
          <View className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
            <Text className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Personalize Your Mood Scale
            </Text>
            <Text className="text-sm text-slate-600 dark:text-slate-300">
              Customize the labels for each mood value (0-10) to match your
              personal experience. Changes will apply throughout the app.
            </Text>
          </View>

          {/* Mood Labels */}
          <View className="space-y-3">
            {labels.map((item) => (
              <View
                key={item.value}
                className={`rounded-2xl p-4 border ${getMoodColor(item.value)}`}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Mood {item.value}
                  </Text>
                  <View className="bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">
                    <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {item.value <= 2
                        ? "Positive"
                        : item.value <= 4
                        ? "Good"
                        : item.value === 5
                        ? "Neutral"
                        : item.value <= 7
                        ? "Low"
                        : "Negative"}
                    </Text>
                  </View>
                </View>
                <TextInput
                  className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 text-base text-slate-900 dark:text-white"
                  value={item.label}
                  onChangeText={(text) => handleLabelChange(item.value, text)}
                  placeholder={`Label for mood ${item.value}`}
                  placeholderTextColor="#94a3b8"
                  maxLength={30}
                  accessibilityLabel={`Label for mood ${item.value}`}
                />
              </View>
            ))}
          </View>

          {/* Action Buttons */}
          <View className="space-y-3 pt-2">
            <Pressable
              onPress={handleSave}
              className="rounded-3xl py-4 items-center bg-blue-600"
              accessibilityRole="button"
              accessibilityLabel="Save custom mood labels"
            >
              <Text className="text-white font-semibold text-base">
                Save Custom Labels
              </Text>
            </Pressable>

            <Pressable
              onPress={handleReset}
              className="rounded-3xl py-4 items-center bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              accessibilityRole="button"
              accessibilityLabel="Reset mood labels to defaults"
            >
              <Text className="text-slate-700 dark:text-slate-200 font-semibold text-base">
                Reset to Defaults
              </Text>
            </Pressable>
          </View>

          <View className="h-8" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
