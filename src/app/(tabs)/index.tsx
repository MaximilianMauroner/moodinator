import React, { useEffect, useCallback, useMemo } from "react";
import { View, Text, SafeAreaView } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ToastManager from "toastify-react-native";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createScreenErrorFallback } from "@/components/ScreenErrorFallback";
import { DateTimePickerModal } from "@/components/DateTimePickerModal";
import { MoodEntryModal, MoodEntryFormValues } from "@/components/MoodEntryModal";
import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import {
  HomeHeader,
  MoodButtonSelector,
  HistoryListHeader,
  MoodHistoryList,
} from "@/components/home";

import { useMoodsStore } from "@/shared/state/moodsStore";
import { useEntrySettings } from "@/hooks/useEntrySettings";
import { useMoodModals } from "@/hooks/useMoodModals";
import { useMoodItemActions } from "@/hooks/useMoodItemActions";
import { useColorScheme } from "@/hooks/useColorScheme";

import { updateMoodTimestamp, migrateEmotionsToCategories } from "@db/db";
import type { MoodEntry } from "@db/types";
import { Toast } from "toastify-react-native";

const HomeErrorFallback = createScreenErrorFallback("Home");

// Toast config with theme support
const createToastConfig = (isDark: boolean) => ({
  success: ({
    text1,
    text2,
    hide,
    onPress,
  }: {
    text1: string;
    text2?: string;
    hide: () => void;
    onPress: () => void;
  }) => (
    <View
      className="flex-row items-center rounded-2xl px-4 py-3 m-3"
      style={{
        backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
        shadowColor: isDark ? "#000" : "#9D8660",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.3 : 0.15,
        shadowRadius: 12,
        elevation: 5,
      }}
    >
      <View className="flex-1 flex-row items-center" style={{ minHeight: 48 }}>
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: isDark ? "#2D3D2D" : "#E8EFE8" }}
        >
          <Text className="text-lg">✓</Text>
        </View>
        <View className="flex-1">
          <Text
            className="font-semibold text-sm"
            style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
          >
            {text1}
          </Text>
          {text2 ? (
            <Text
              className="text-xs mt-0.5"
              style={{ color: isDark ? "#BDA77D" : "#6B5C4A" }}
            >
              {text2}
            </Text>
          ) : null}
        </View>
        <HapticTab onPress={onPress}>
          <View
            className="px-3 py-2 rounded-xl ml-2"
            style={{ backgroundColor: isDark ? "#2D3D2D" : "#E8EFE8" }}
          >
            <Text
              className="font-semibold text-sm"
              style={{ color: isDark ? "#A8C5A8" : "#5B8A5B" }}
            >
              Undo
            </Text>
          </View>
        </HapticTab>
      </View>
      <HapticTab onPress={hide} className="ml-2">
        <IconSymbol name="xmark" size={18} color={isDark ? "#6B5C4A" : "#7A6B55"} />
      </HapticTab>
    </View>
  ),
});

function HomeScreenContent() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const toastConfig = useMemo(() => createToastConfig(isDark), [isDark]);

  // Zustand store for mood data
  const moods = useMoodsStore((state) => state.moods);
  const status = useMoodsStore((state) => state.status);
  const lastTracked = useMoodsStore((state) => state.lastTracked);
  const loadAll = useMoodsStore((state) => state.loadAll);
  const refreshMoods = useMoodsStore((state) => state.refreshMoods);
  const createMood = useMoodsStore((state) => state.create);
  const updateMood = useMoodsStore((state) => state.update);
  const setLocal = useMoodsStore((state) => state.setLocal);

  const loading = status === "loading";
  const refreshing = status === "refreshing";

  // Wrapper for setMoods that supports function updaters
  const setMoods = useCallback(
    (updater: MoodEntry[] | ((prev: MoodEntry[]) => MoodEntry[])) => {
      if (typeof updater === "function") {
        const currentMoods = useMoodsStore.getState().moods;
        setLocal(updater(currentMoods));
      } else {
        setLocal(updater);
      }
    },
    [setLocal]
  );

  // Custom hooks for other state management
  const entrySettings = useEntrySettings();
  const modals = useMoodModals();
  const itemActions = useMoodItemActions({
    setMoods,
    setLastTracked: () => {}, // lastTracked is computed from moods
    setEditingEntry: modals.setEditingEntry,
  });

  // Load moods on mount
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Run emotion migration on mount
  const runEmotionMigration = useCallback(async () => {
    const MIGRATION_KEY = "emotionCategoryMigrationCompleted";
    const MIGRATION_RETRY_KEY = "emotionCategoryMigrationRetries";
    const MAX_MIGRATION_RETRIES = 3;

    try {
      const migrationStatus = await AsyncStorage.getItem(MIGRATION_KEY);

      if (migrationStatus === "true" || migrationStatus === "failed") {
        return;
      }

      console.log("Running emotion category migration...");
      const result = await migrateEmotionsToCategories();
      console.log(`Migration complete: ${result.migrated} entries migrated, ${result.skipped} skipped`);
      await AsyncStorage.setItem(MIGRATION_KEY, "true");
      await loadAll();
    } catch (error) {
      console.error("Failed to run emotion migration:", error);

      try {
        const currentRetriesRaw = await AsyncStorage.getItem(MIGRATION_RETRY_KEY);
        const currentRetries = currentRetriesRaw ? parseInt(currentRetriesRaw, 10) || 0 : 0;
        const nextRetries = currentRetries + 1;

        await AsyncStorage.setItem(MIGRATION_RETRY_KEY, String(nextRetries));

        if (nextRetries >= MAX_MIGRATION_RETRIES) {
          await AsyncStorage.setItem(MIGRATION_KEY, "failed");

          Toast.show({
            type: "error",
            text1: "Migration Issue",
            text2: "We couldn't finish updating some past mood entries. New entries will still work.",
          });
        }
      } catch (storageError) {
        console.error("Failed to update migration retry state:", storageError);
      }
    }
  }, [loadAll]);

  useEffect(() => {
    runEmotionMigration();
  }, [runEmotionMigration]);

  // Entry save handlers
  const handleEntrySave = useCallback(async (values: MoodEntryFormValues) => {
    await createMood({
      mood: values.mood,
      note: values.note || null,
      emotions: values.emotions,
      contextTags: values.contextTags,
      energy: values.energy,
      photos: values.photos,
      location: values.location,
      voiceMemos: values.voiceMemos,
    });
  }, [createMood]);

  const handleEditEntrySave = useCallback(
    async (values: MoodEntryFormValues) => {
      if (!modals.editingEntry) return;
      await updateMood(modals.editingEntry.id, {
        mood: values.mood,
        note: values.note ? values.note : null,
        emotions: values.emotions,
        contextTags: values.contextTags,
        energy: values.energy,
        photos: values.photos,
        location: values.location,
        voiceMemos: values.voiceMemos,
      });
    },
    [modals.editingEntry, updateMood]
  );

  const handleDateTimeSave = useCallback(
    async (moodId: number, newTimestamp: number) => {
      await updateMoodTimestamp(moodId, newTimestamp);
      await loadAll();
      modals.closeDateModal();
    },
    [loadAll, modals.closeDateModal]
  );

  const handleMoodItemLongPress = useCallback(
    (mood: MoodEntry) => {
      modals.openDateModal(mood);
    },
    [modals.openDateModal]
  );

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView
          className="flex-1"
          style={{ backgroundColor: isDark ? "#1C1916" : "#FAF8F4" }}
        >
          <View className="flex-1 px-4 pt-4">
            {/* Header */}
            <HomeHeader lastTracked={lastTracked} />

            {/* Mood Buttons */}
            <MoodButtonSelector
              showDetailedLabels={entrySettings.showDetailedLabels}
              onMoodPress={modals.handleMoodPress}
              onLongPress={modals.handleLongPress}
            />

            {/* History Section */}
            <View className="flex-1 mt-4">
              <HistoryListHeader moodCount={moods.length} />
              <MoodHistoryList
                moods={moods}
                loading={loading}
                refreshing={refreshing}
                onRefresh={refreshMoods}
                onSwipeableWillOpen={itemActions.onSwipeableWillOpen}
                onMoodItemLongPress={handleMoodItemLongPress}
                swipeThreshold={itemActions.SWIPE_THRESHOLD}
              />
            </View>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>

      {/* Modals */}
      {modals.showDateModal && (
        <DateTimePickerModal
          visible={modals.showDateModal}
          mood={modals.selectedMood}
          onClose={modals.closeDateModal}
          onSave={handleDateTimeSave}
        />
      )}
      <MoodEntryModal
        visible={modals.quickEntryVisible}
        title="Quick Entry"
        initialMood={modals.pendingMood}
        emotionOptions={entrySettings.emotionOptions}
        contextOptions={entrySettings.contextOptions}
        fieldConfig={entrySettings.quickEntryFieldConfig}
        showMoodSelector={false}
        onClose={modals.closeQuickEntry}
        onSubmit={handleEntrySave}
      />
      <MoodEntryModal
        visible={modals.detailedEntryVisible}
        title="Detailed Entry"
        initialMood={modals.pendingMood}
        emotionOptions={entrySettings.emotionOptions}
        contextOptions={entrySettings.contextOptions}
        fieldConfig={entrySettings.detailedFieldConfig}
        showMoodSelector={false}
        onClose={modals.closeDetailedEntry}
        onSubmit={handleEntrySave}
      />
      <MoodEntryModal
        visible={Boolean(modals.editingEntry)}
        title="Edit Entry"
        initialMood={modals.editingEntry?.mood ?? modals.pendingMood}
        emotionOptions={entrySettings.emotionOptions}
        contextOptions={entrySettings.contextOptions}
        fieldConfig={entrySettings.detailedFieldConfig}
        initialValues={modals.editingInitialValues}
        onClose={modals.closeEditEntry}
        onSubmit={handleEditEntrySave}
      />
      <ToastManager config={toastConfig} useModal={false} />
    </>
  );
}

export default function HomeScreen() {
  return (
    <ErrorBoundary FallbackComponent={HomeErrorFallback}>
      <HomeScreenContent />
    </ErrorBoundary>
  );
}
