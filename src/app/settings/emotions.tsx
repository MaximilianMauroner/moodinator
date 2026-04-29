import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettingsStore } from "@/shared/state/settingsStore";
import { DEFAULT_EMOTIONS } from "@/lib/entrySettings";
import type { Emotion } from "@db/types";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import { SettingsSection } from "@/features/settings/components/SettingsSection";
import { SettingRow } from "@/features/settings/components/SettingRow";
import { EmotionListEditor } from "@/features/settings/components/EmotionListEditor";
import { emotionService } from "@/services/emotionService";

export default function EmotionsSettingsScreen() {

  const emotions = useSettingsStore((state) => state.emotions);
  const setEmotions = useSettingsStore((state) => state.setEmotions);

  const [newEmotion, setNewEmotion] = useState("");
  const [newEmotionCategory, setNewEmotionCategory] = useState<Emotion["category"]>("neutral");

  const handleAddEmotion = useCallback(async () => {
    const trimmed = newEmotion.trim();
    if (!trimmed) return;
    const trimmedLower = trimmed.toLowerCase();
    if (emotions.some((emotion) => emotion.name.toLowerCase() === trimmedLower)) {
      Alert.alert("Duplicate Emotion", "This emotion is already in the list.");
      return;
    }
    const updated = [...emotions, { name: trimmed, category: newEmotionCategory } as Emotion];
    await setEmotions(updated);
    setNewEmotion("");
  }, [emotions, newEmotion, newEmotionCategory, setEmotions]);

  const handleUpdateEmotionCategory = useCallback(
    async (name: string, category: Emotion["category"]) => {
      const target = name.trim().toLowerCase();
      const updated = emotions.map((emotion) =>
        emotion.name.trim().toLowerCase() === target ? { ...emotion, category } : emotion
      );
      const changed = emotions.some(
        (emotion) => emotion.name.trim().toLowerCase() === target && emotion.category !== category
      );
      if (!changed) return;
      await setEmotions(updated);

      try {
        const preview = await emotionService.previewCategoryHistoricalUpdate(name, category);
        if (preview.affectedMoodEntryCount === 0) {
          return;
        }

        Alert.alert(
          "Update Past Mood Entries?",
          `Apply this category change to ${preview.affectedMoodEntryCount} past Mood ${preview.affectedMoodEntryCount === 1 ? "Entry" : "Entries"} that use ${name}?`,
          [
            {
              text: "Future Only",
              style: "cancel",
            },
            {
              text: "Update Past Entries",
              onPress: async () => {
                try {
                  await emotionService.applyCategoryHistoricalUpdate(name, category);
                } catch (error) {
                  console.error("Failed to apply historical category update:", error);
                  Alert.alert(
                    "Historical Update Failed",
                    "The category was saved for future selection only."
                  );
                }
              },
            },
          ]
        );
      } catch (error) {
        console.error("Failed to preview historical category update:", error);
        Alert.alert(
          "Category Saved",
          "The category was updated for future selection, but we couldn't preview past Mood Entries."
        );
      }
    },
    [emotions, setEmotions]
  );

  const handleRemoveEmotion = useCallback(
    async (value: string) => {
      Alert.alert("Remove Emotion", "Remove this emotion from future selection? Past Mood Entries will keep their original emotion snapshots.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const updated = emotions.filter((item) => item.name !== value);
            await setEmotions(updated.length > 0 ? updated : DEFAULT_EMOTIONS);
          },
        },
      ]);
    },
    [emotions, setEmotions]
  );

  const handleImportFromEntries = useCallback(async () => {
    try {
      const names = await emotionService.getImportableEmotionNames();
      if (names.length === 0) {
        Alert.alert("No Emotions Found", "No emotions were found in past entries.");
        return;
      }
      const existing = new Set(emotions.map((e) => e.name.trim().toLowerCase()));
      const additions = names.filter((name) => !existing.has(name.trim().toLowerCase()));
      if (additions.length === 0) {
        Alert.alert("Up to Date", "All emotions from past entries are already in your presets.");
        return;
      }
      const updated = [...emotions, ...additions.map((name) => ({ name, category: "neutral" }) as Emotion)];
      await setEmotions(updated);
      Alert.alert("Imported", `Added ${additions.length} emotion${additions.length === 1 ? "" : "s"}.`);
    } catch (error) {
      console.error("Failed to import emotions from entries:", error);
      Alert.alert("Import Failed", "Could not import emotions from entries.");
    }
  }, [emotions, setEmotions]);

  // Count by category
  const positiveCount = emotions.filter((e) => e.category === "positive").length;
  const negativeCount = emotions.filter((e) => e.category === "negative").length;
  const neutralCount = emotions.filter((e) => e.category === "neutral").length;

  return (
    <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
      <SettingsPageHeader
        title="Emotions"
        subtitle="Customization"
        icon="happy-outline"
        accentColor="coral"
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Stats banner */}
        <View className="mx-4 mb-4 p-4 rounded-2xl bg-coral-100 dark:bg-coral-600/20">
          <View className="flex-row items-center justify-between">
            <View className="items-center flex-1">
              <Text className="text-2xl font-bold text-sage-500 dark:text-sage-300">
                {positiveCount}
              </Text>
              <Text className="text-xs text-sand-500 dark:text-sand-400">Positive</Text>
            </View>
            <View className="w-px h-8 bg-coral-200 dark:bg-coral-500/30" />
            <View className="items-center flex-1">
              <Text className="text-2xl font-bold text-coral-600 dark:text-coral-300">
                {negativeCount}
              </Text>
              <Text className="text-xs text-sand-500 dark:text-sand-400">Negative</Text>
            </View>
            <View className="w-px h-8 bg-coral-200 dark:bg-coral-500/30" />
            <View className="items-center flex-1">
              <Text className="text-2xl font-bold text-dusk-500 dark:text-dusk-300">
                {neutralCount}
              </Text>
              <Text className="text-xs text-sand-500 dark:text-sand-400">Neutral</Text>
            </View>
          </View>
        </View>

        <SettingsSection>
          <EmotionListEditor
            title="Your Emotions"
            description="Tap an emotion to change its category"
            placeholder="Add emotion..."
            emotions={emotions}
            newValue={newEmotion}
            newCategory={newEmotionCategory}
            onChangeNewValue={setNewEmotion}
            onChangeNewCategory={setNewEmotionCategory}
            onAdd={handleAddEmotion}
            onRemove={handleRemoveEmotion}
            onUpdateCategory={handleUpdateEmotionCategory}
          />
        </SettingsSection>

        <SettingsSection title="Import">
          <SettingRow
            label="Import from entries"
            subLabel="Add emotions from past entries as presets"
            icon="download-outline"
            onPress={handleImportFromEntries}
            isLast
          />
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}
