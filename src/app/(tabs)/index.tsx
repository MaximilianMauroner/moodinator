import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  SafeAreaView,
  RefreshControl,
  FlatList,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  insertMood,
  getAllMoods,
  deleteMood,
  insertMoodEntry,
  updateMoodTimestamp,
  updateMoodEntry,
  migrateEmotionsToCategories,
} from "@db/db";
import { DisplayMoodItem } from "@/components/DisplayMoodItem";
import { DateTimePickerModal } from "@/components/DateTimePickerModal";
import { MoodButtonsDetailed } from "@/components/MoodButtonsDetailed";
import { MoodButtonsCompact } from "@/components/MoodButtonsCompact";
import { SwipeDirection } from "@/types/mood";
import { MoodEntry, Emotion } from "@db/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import ToastManager, { Toast } from "toastify-react-native";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { HapticTab } from "@/components/HapticTab";
import {
  DEFAULT_CONTEXTS,
  DEFAULT_EMOTIONS,
  DEFAULT_QUICK_ENTRY_PREFS,
  getContextTags,
  getEmotionPresets,
  getQuickEntryPrefs,
  QuickEntryPrefs,
} from "@/lib/entrySettings";
import {
  MoodEntryFormValues,
  MoodEntryModal,
} from "@/components/MoodEntryModal";
import { useColorScheme } from "@/hooks/useColorScheme";
const SHOW_LABELS_KEY = "showLabelsPreference";

// Toast config will be generated inside component with color scheme access
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
              style={{ color: isDark ? "#BDA77D" : "#9D8660" }}
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
        <IconSymbol name="xmark" size={18} color={isDark ? "#6B5C4A" : "#BDA77D"} />
      </HapticTab>
    </View>
  ),
});

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const toastConfig = useMemo(() => createToastConfig(isDark), [isDark]);

  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastTracked, setLastTracked] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showDetailedLabels, setShowDetailedLabels] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedMood, setSelectedMood] = useState<MoodEntry | null>(null);
  const [quickEntryVisible, setQuickEntryVisible] = useState(false);
  const [detailedEntryVisible, setDetailedEntryVisible] = useState(false);
  const [pendingMood, setPendingMood] = useState(5);
  const [editingEntry, setEditingEntry] = useState<MoodEntry | null>(null);
  const [emotionOptions, setEmotionOptions] =
    useState<Emotion[]>(DEFAULT_EMOTIONS);
  const [contextOptions, setContextOptions] =
    useState<string[]>(DEFAULT_CONTEXTS);
  const [quickEntryPrefs, setQuickEntryPrefs] = useState<QuickEntryPrefs>(
    DEFAULT_QUICK_ENTRY_PREFS
  );
  const quickEntryFieldConfig = useMemo(
    () => ({
      emotions: quickEntryPrefs.showEmotions,
      context: quickEntryPrefs.showContext,
      energy: quickEntryPrefs.showEnergy,
      notes: quickEntryPrefs.showNotes,
    }),
    [quickEntryPrefs]
  );
  const detailedFieldConfig = useMemo(
    () => ({
      emotions: true,
      context: true,
      energy: true,
      notes: true,
    }),
    []
  );

  const SWIPE_THRESHOLD = 100;

  const fetchMoods = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllMoods();
      setMoods(data);
      if (data.length > 0) {
        setLastTracked(new Date(data[0].timestamp));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refreshMoods = useCallback(async () => {
    try {
      const data = await getAllMoods();
      setMoods(data);
      if (data.length > 0) {
        setLastTracked(new Date(data[0].timestamp));
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshMoods();
  }, [refreshMoods]);

  useEffect(() => {
    fetchMoods();
  }, []);

  const handleMoodPress = useCallback((mood: number) => {
    setPendingMood(mood);
    setQuickEntryVisible(true);
  }, []);

  const handleLongPress = useCallback((mood: number) => {
    setPendingMood(mood);
    setDetailedEntryVisible(true);
  }, []);

  const handleDeleteMood = useCallback(async (mood: MoodEntry) => {
    await deleteMood(mood.id);
    setMoods((prev) => prev.filter((m) => m.id !== mood.id));
    Toast.show({
      type: "success",
      text1: "Entry removed",
      text2: "Tap Undo to restore",
      autoHide: true,
      visibilityTime: 3000,
      progressBarColor: "#A78BFA",
      onPress: async () => {
        if (mood) {
          const crmood = await insertMoodEntry({
            mood: mood.mood,
            note: mood.note,
            timestamp: new Date(mood.timestamp).getTime(),
            emotions: mood.emotions,
            contextTags: mood.contextTags,
            energy: mood.energy,
          });

          setMoods((prev) => {
            const updated = [...prev, crmood].sort(
              (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime()
            );
            return updated;
          });

          setLastTracked((prevLastTracked) => {
            if (
              !prevLastTracked ||
              new Date(crmood.timestamp) > prevLastTracked
            ) {
              return new Date(crmood.timestamp);
            }
            return prevLastTracked;
          });
          Toast.hide();
        } else {
          Toast.error("Failed to restore mood");
        }
      },
    });
  }, []);

  const onSwipeableWillOpen = useCallback(
    (direction: SwipeDirection, mood: MoodEntry) => {
      if (direction === "left") {
        handleDeleteMood(mood);
      } else if (direction === "right") {
        setEditingEntry(mood);
      }
    },
    [handleDeleteMood]
  );

  const handleMoodItemLongPress = useCallback((mood: MoodEntry) => {
    setSelectedMood(mood);
    setShowDateModal(true);
  }, []);

  const handleDateTimeSave = useCallback(
    async (moodId: number, newTimestamp: number) => {
      await updateMoodTimestamp(moodId, newTimestamp);
      await fetchMoods();
      setShowDateModal(false);
    },
    [fetchMoods]
  );

  const renderMoodItem = useCallback(
    ({ item }: { item: MoodEntry }) => (
      <DisplayMoodItem
        mood={item}
        onSwipeableWillOpen={onSwipeableWillOpen}
        onLongPress={handleMoodItemLongPress}
        swipeThreshold={SWIPE_THRESHOLD}
      />
    ),
    [onSwipeableWillOpen, handleMoodItemLongPress]
  );

  const loadShowLabelsPreference = useCallback(async () => {
    try {
      const value = await AsyncStorage.getItem(SHOW_LABELS_KEY);
      if (value !== null) {
        setShowDetailedLabels(value === "true");
      }
    } catch (error) {
      console.error("Failed to load label preference:", error);
    }
  }, []);

  const loadEntrySettings = useCallback(async () => {
    try {
      const [emotionList, contextList, prefs] = await Promise.all([
        getEmotionPresets(),
        getContextTags(),
        getQuickEntryPrefs(),
      ]);
      setEmotionOptions(emotionList);
      setContextOptions(contextList);
      setQuickEntryPrefs(prefs);
    } catch (error) {
      console.error("Failed to load entry settings:", error);
    }
  }, []);

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
      await fetchMoods();
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
  }, [fetchMoods]);

  useEffect(() => {
    loadShowLabelsPreference();
    runEmotionMigration();
  }, [loadShowLabelsPreference, runEmotionMigration]);

  useFocusEffect(
    useCallback(() => {
      loadShowLabelsPreference();
      loadEntrySettings();
    }, [loadShowLabelsPreference, loadEntrySettings])
  );

  const handleEntrySave = useCallback(async (values: MoodEntryFormValues) => {
    const newMood = await insertMood(values.mood, values.note || undefined, {
      emotions: values.emotions,
      contextTags: values.contextTags,
      energy: values.energy,
    });
    setMoods((prev) => [newMood, ...prev]);
    setLastTracked(new Date(newMood.timestamp ?? Date.now()));
  }, []);

  const handleEditEntrySave = useCallback(
    async (values: MoodEntryFormValues) => {
      if (!editingEntry) return;
      const updatedMood = await updateMoodEntry(editingEntry.id, {
        mood: values.mood,
        note: values.note ? values.note : null,
        emotions: values.emotions,
        contextTags: values.contextTags,
        energy: values.energy,
      });
      if (updatedMood) {
        setMoods((prev) =>
          prev.map((m) => (m.id === updatedMood.id ? updatedMood : m))
        );
      }
    },
    [editingEntry]
  );

  const editingInitialValues = useMemo(
    () =>
      editingEntry
        ? {
            mood: editingEntry.mood,
            emotions: editingEntry.emotions,
            contextTags: editingEntry.contextTags,
            energy: editingEntry.energy,
            note: editingEntry.note ?? "",
          }
        : undefined,
    [editingEntry]
  );

  useEffect(() => {
    loadEntrySettings();
  }, [loadEntrySettings]);

  const renderEmptyComponent = useCallback(() => {
    return (
      <View className="flex-1 items-center justify-center p-8">
        {loading ? (
          <Text
            className="text-center"
            style={{ color: isDark ? "#BDA77D" : "#9D8660" }}
          >
            Loading...
          </Text>
        ) : (
          <View className="items-center">
            <View
              className="w-24 h-24 rounded-3xl items-center justify-center mb-5"
              style={{
                backgroundColor: isDark ? "#2D3D2D" : "#E8EFE8",
                shadowColor: isDark ? "#000" : "#5B8A5B",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isDark ? 0.3 : 0.15,
                shadowRadius: 16,
                elevation: 4,
              }}
            >
              <Text className="text-5xl">🌿</Text>
            </View>
            <Text
              className="text-center font-semibold text-lg mb-1"
              style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
            >
              Start your journey
            </Text>
            <Text
              className="text-center text-sm max-w-[200px]"
              style={{ color: isDark ? "#BDA77D" : "#9D8660" }}
            >
              Tap a mood above to log how you're feeling right now
            </Text>
          </View>
        )}
      </View>
    );
  }, [loading, isDark]);

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView
          className="flex-1"
          style={{ backgroundColor: isDark ? "#1C1916" : "#FAF8F4" }}
        >
          <View className="flex-1 px-4 pt-4">
            {/* Organic header */}
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text
                  className="text-3xl font-bold"
                  style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
                >
                  Moodinator
                </Text>
                <Text
                  className="text-sm mt-1"
                  style={{ color: isDark ? "#BDA77D" : "#9D8660" }}
                >
                  Track your emotional wellness
                </Text>
              </View>
              {lastTracked && (
                <View
                  className="px-3 py-2 rounded-xl"
                  style={{
                    backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
                    shadowColor: isDark ? "#000" : "#9D8660",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isDark ? 0.25 : 0.08,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  <Text
                    className="text-[10px] font-medium mb-0.5"
                    style={{ color: isDark ? "#6B5C4A" : "#BDA77D" }}
                  >
                    Last entry
                  </Text>
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: isDark ? "#D4C4A0" : "#6B5C4A" }}
                  >
                    {lastTracked.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              )}
            </View>

            {/* Mood buttons */}
            <View>
              {showDetailedLabels ? (
                <MoodButtonsDetailed
                  onMoodPress={handleMoodPress}
                  onLongPress={handleLongPress}
                />
              ) : (
                <MoodButtonsCompact
                  onMoodPress={handleMoodPress}
                  onLongPress={handleLongPress}
                />
              )}
            </View>

            {/* History section */}
            <View className="flex-1 mt-4">
              <View className="flex-row justify-between items-center mb-3 px-1">
                <Text
                  className="font-semibold text-base"
                  style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
                >
                  Recent entries
                </Text>
                {moods.length > 0 && (
                  <View
                    className="px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: isDark ? "#2D3D2D" : "#E8EFE8" }}
                  >
                    <Text
                      className="text-xs font-medium"
                      style={{ color: isDark ? "#A8C5A8" : "#5B8A5B" }}
                    >
                      {moods.length} total
                    </Text>
                  </View>
                )}
              </View>
              <FlatList
                data={moods}
                initialNumToRender={10}
                contentContainerStyle={{
                  paddingBottom: 100,
                }}
                renderItem={renderMoodItem}
                keyExtractor={(item) => item.id.toString()}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={[isDark ? "#7BA87B" : "#5B8A5B"]}
                    tintColor={isDark ? "#7BA87B" : "#5B8A5B"}
                  />
                }
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={true}
                windowSize={7}
                maxToRenderPerBatch={10}
                updateCellsBatchingPeriod={50}
                extraData={moods}
                style={{ flex: 1 }}
                ListEmptyComponent={renderEmptyComponent}
              />
            </View>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
      {showDateModal && (
        <DateTimePickerModal
          visible={showDateModal}
          mood={selectedMood}
          onClose={() => setShowDateModal(false)}
          onSave={handleDateTimeSave}
        />
      )}
      <MoodEntryModal
        visible={quickEntryVisible}
        title="Quick Entry"
        initialMood={pendingMood}
        emotionOptions={emotionOptions}
        contextOptions={contextOptions}
        fieldConfig={quickEntryFieldConfig}
        showMoodSelector={false}
        onClose={() => setQuickEntryVisible(false)}
        onSubmit={handleEntrySave}
      />
      <MoodEntryModal
        visible={detailedEntryVisible}
        title="Detailed Entry"
        initialMood={pendingMood}
        emotionOptions={emotionOptions}
        contextOptions={contextOptions}
        fieldConfig={detailedFieldConfig}
        showMoodSelector={false}
        onClose={() => setDetailedEntryVisible(false)}
        onSubmit={handleEntrySave}
      />
      <MoodEntryModal
        visible={Boolean(editingEntry)}
        title="Edit Entry"
        initialMood={editingEntry?.mood ?? pendingMood}
        emotionOptions={emotionOptions}
        contextOptions={contextOptions}
        fieldConfig={detailedFieldConfig}
        initialValues={editingInitialValues}
        onClose={() => setEditingEntry(null)}
        onSubmit={handleEditEntrySave}
      />
      <ToastManager config={toastConfig} useModal={false} />
    </>
  );
}
