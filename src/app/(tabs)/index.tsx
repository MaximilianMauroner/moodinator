import React, { useEffect, useCallback, useMemo, useState } from "react";
import { View, Text, RefreshControl, type LayoutChangeEvent } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ToastManager from "toastify-react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createScreenErrorFallback } from "@/components/ScreenErrorFallback";
import { DateTimePickerModal } from "@/components/DateTimePickerModal";
import {
  DetailedMoodEntryModal,
  EditMoodEntryModal,
  MoodEntryFormValues,
  QuickMoodEntryModal,
} from "@/components/MoodEntryModal";
import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { DisplayMoodItem } from "@/components/DisplayMoodItem";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  CompactMoodButtonSelector,
  DetailedMoodButtonSelector,
  HomeHeader,
  HistoryListHeader,
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
const COMPACT_TOP_COLLAPSE = 180;
const DETAILED_TOP_COLLAPSE = 220;

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
          <Ionicons
            name="checkmark"
            size={20}
            color={isDark ? "#A8C5A8" : "#5B8A5B"}
          />
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
  const [topSectionHeight, setTopSectionHeight] = useState(0);
  const topSectionScrollY = useSharedValue(0);

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
    [loadAll, modals]
  );

  const handleMoodItemLongPress = useCallback(
    (mood: MoodEntry) => {
      modals.openDateModal(mood);
    },
    [modals]
  );

  const keyExtractor = useCallback((item: MoodEntry) => item.id.toString(), []);

  const renderMoodItem = useCallback(
    ({ item }: { item: MoodEntry }) => (
      <DisplayMoodItem
        mood={item}
        onSwipeableWillOpen={itemActions.onSwipeableWillOpen}
        onLongPress={handleMoodItemLongPress}
        swipeThreshold={itemActions.SWIPE_THRESHOLD}
      />
    ),
    [handleMoodItemLongPress, itemActions.SWIPE_THRESHOLD, itemActions.onSwipeableWillOpen]
  );

  const estimatedTopSectionHeight = entrySettings.showDetailedLabels ? 560 : 440;
  const expandedTopSectionHeight = topSectionHeight || estimatedTopSectionHeight;
  const maxTopCollapse = entrySettings.showDetailedLabels
    ? DETAILED_TOP_COLLAPSE
    : COMPACT_TOP_COLLAPSE;
  const topCollapseDistance = Math.min(
    maxTopCollapse,
    Math.max(expandedTopSectionHeight - 160, 0)
  );

  const handleTopSectionLayout = useCallback(
    ({ nativeEvent }: LayoutChangeEvent) => {
      const measuredHeight = Math.ceil(nativeEvent.layout.height);

      setTopSectionHeight((currentHeight) =>
        currentHeight === measuredHeight ? currentHeight : measuredHeight
      );
    },
    []
  );

  const handleListScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      topSectionScrollY.value = Math.max(event.nativeEvent.contentOffset.y, 0);
    },
    [topSectionScrollY]
  );

  const topSectionAnimatedStyle = useAnimatedStyle(
    () => ({
      height:
        expandedTopSectionHeight -
        Math.min(topSectionScrollY, topCollapseDistance),
    }),
    [expandedTopSectionHeight, topCollapseDistance]
  );

  const topSectionContentAnimatedStyle = useAnimatedStyle(
    () => {
      const collapsedOffset = Math.min(topSectionScrollY, topCollapseDistance);

      return {
        opacity: interpolate(
          collapsedOffset,
          [0, topCollapseDistance],
          [1, 0.96],
          Extrapolation.CLAMP
        ),
        transform: [
          {
            translateY: interpolate(
              collapsedOffset,
              [0, topCollapseDistance],
              [0, -topCollapseDistance * 0.55],
              Extrapolation.CLAMP
            ),
          },
        ],
      };
    },
    [topCollapseDistance]
  );

  const listEmptyComponent = useMemo(
    () =>
      loading ? (
        <LoadingSpinner message="Loading..." />
      ) : (
        <EmptyState
          icon="leaf-outline"
          tone="sage"
          title="Start your journey"
          description="Tap a mood above to log how you're feeling right now"
        />
      ),
    [loading]
  );

  const listRefreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={refreshMoods}
        colors={[isDark ? "#7BA87B" : "#5B8A5B"]}
        tintColor={isDark ? "#7BA87B" : "#5B8A5B"}
      />
    ),
    [isDark, refreshMoods, refreshing]
  );

  const listContentContainerStyle = useMemo(
    () => ({
      paddingBottom: 100,
    }),
    []
  );

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView
          className="flex-1"
          style={{ backgroundColor: isDark ? "#1C1916" : "#FAF8F4" }}
        >
          <View className="flex-1 px-4 pt-4">
            <Animated.View
              style={[topSectionAnimatedStyle, { overflow: "hidden" }]}
            >
              <Animated.View
                onLayout={handleTopSectionLayout}
                style={topSectionContentAnimatedStyle}
              >
                <HomeHeader lastTracked={lastTracked} />
                {entrySettings.showDetailedLabels ? (
                  <DetailedMoodButtonSelector
                    onMoodPress={modals.handleMoodPress}
                    onLongPress={modals.handleLongPress}
                  />
                ) : (
                  <CompactMoodButtonSelector
                    onMoodPress={modals.handleMoodPress}
                    onLongPress={modals.handleLongPress}
                  />
                )}
              </Animated.View>
            </Animated.View>

            <View className="flex-1 mt-4">
              <HistoryListHeader moodCount={moods.length} />
              <FlashList
                data={moods}
                keyExtractor={keyExtractor}
                renderItem={renderMoodItem}
                ListEmptyComponent={listEmptyComponent}
                refreshControl={listRefreshControl}
                contentInsetAdjustmentBehavior="automatic"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={listContentContainerStyle}
                onScroll={handleListScroll}
                scrollEventThrottle={16}
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
      <QuickMoodEntryModal
        visible={modals.quickEntryVisible}
        initialMood={modals.pendingMood}
        emotionOptions={entrySettings.emotionOptions}
        contextOptions={entrySettings.contextOptions}
        fieldConfig={entrySettings.quickEntryFieldConfig}
        onClose={modals.closeQuickEntry}
        onSubmit={handleEntrySave}
      />
      <DetailedMoodEntryModal
        visible={modals.detailedEntryVisible}
        initialMood={modals.pendingMood}
        emotionOptions={entrySettings.emotionOptions}
        contextOptions={entrySettings.contextOptions}
        fieldConfig={entrySettings.detailedFieldConfig}
        onClose={modals.closeDetailedEntry}
        onSubmit={handleEntrySave}
      />
      <EditMoodEntryModal
        visible={Boolean(modals.editingEntry)}
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
