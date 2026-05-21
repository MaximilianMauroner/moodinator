import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  RefreshControl,
  ScrollView as RNScrollView,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
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
import { DisplayMoodItem } from "@/components/DisplayMoodItem";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  DetailedMoodButtonSelector,
  HomeHeader,
  HistoryListHeader,
  UnifiedMoodSelector,
  UNIFIED_COMPACT_EXPANDED_HEIGHT,
} from "@/components/home";

import { useMoodsStore } from "@/shared/state/moodsStore";
import { useEntrySettings } from "@/hooks/useEntrySettings";
import { useMoodModals } from "@/hooks/useMoodModals";
import { useMoodItemActions } from "@/hooks/useMoodItemActions";
import { useColorScheme } from "@/hooks/useColorScheme";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

import type { MoodEntry } from "@db/types";
import { emotionService } from "@/services/emotionService";
import { toastService } from "@/services/toastService";
import { moodScale } from "@/constants/moodScale";

const HomeErrorFallback = createScreenErrorFallback("Home");
const COLLAPSED_SELECTOR_HEIGHT = 60;
const DEFAULT_DETAILED_PANEL_HEIGHT = 484;
const MIN_COLLAPSE_DISTANCE = 80;
const COLLAPSED_PROGRESS = 0.995;
const HEADER_TOP_PADDING = 16;
const HEADER_SECTION_GAP = 16;
const CONTENT_HORIZONTAL_PADDING = 16;
const ESTIMATED_HOME_CHROME_HEIGHT = 72;
const ESTIMATED_HISTORY_CHROME_HEIGHT = 56;

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

function HomeScreenContent() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const moods = useMoodsStore((state) => state.moods);
  const status = useMoodsStore((state) => state.status);
  const loadAll = useMoodsStore((state) => state.loadAll);
  const refreshMoods = useMoodsStore((state) => state.refreshMoods);
  const createMood = useMoodsStore((state) => state.create);
  const updateMood = useMoodsStore((state) => state.update);
  const updateMoodTimestamp = useMoodsStore((state) => state.updateTimestamp);
  const setLocal = useMoodsStore((state) => state.setLocal);

  const loading = status === "loading";
  const [homeChromeHeight, setHomeChromeHeight] = useState(0);
  const [expandedPanelHeight, setExpandedPanelHeight] = useState(0);
  const [historyChromeHeight, setHistoryChromeHeight] = useState(0);
  const [selectorCollapsed, setSelectorCollapsed] = useState(false);
  const { refreshing, onRefresh: handlePullToRefresh } = usePullToRefresh(refreshMoods);

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

  const entrySettings = useEntrySettings();
  const modals = useMoodModals();
  const itemActions = useMoodItemActions({
    setMoods,
    setLastTracked: () => {},
    setEditingEntry: modals.setEditingEntry,
  });

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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
      const result = await emotionService.migrateToCategories();
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

          toastService.error(
            "Migration issue",
            "We couldn't finish updating some past mood entries. New entries will still work."
          );
        }
      } catch (storageError) {
        console.error("Failed to update migration retry state:", storageError);
      }
    }
  }, [loadAll]);

  useEffect(() => {
    runEmotionMigration();
  }, [runEmotionMigration]);

  const handleEntrySave = useCallback(async (values: MoodEntryFormValues) => {
    await createMood({
      mood: values.mood,
      note: values.note || null,
      emotions: values.emotions,
      contextTags: values.contextTags,
      energy: values.energy,
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
      });
    },
    [modals.editingEntry, updateMood]
  );

  const handleDateTimeSave = useCallback(
    async (moodId: number, newTimestamp: number) => {
      await updateMoodTimestamp(moodId, newTimestamp);
      modals.closeDateModal();
    },
    [modals, updateMoodTimestamp]
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

  const estimatedExpandedPanelHeight = entrySettings.showDetailedLabels
    ? DEFAULT_DETAILED_PANEL_HEIGHT
    : UNIFIED_COMPACT_EXPANDED_HEIGHT;
  const currentExpandedPanelHeight = expandedPanelHeight || estimatedExpandedPanelHeight;
  const currentHomeChromeHeight = homeChromeHeight || ESTIMATED_HOME_CHROME_HEIGHT;
  const currentHistoryChromeHeight = historyChromeHeight || ESTIMATED_HISTORY_CHROME_HEIGHT;
  const collapseDistance = Math.max(
    currentExpandedPanelHeight - COLLAPSED_SELECTOR_HEIGHT,
    MIN_COLLAPSE_DISTANCE
  );
  const totalExpandedHeaderHeight =
    currentHomeChromeHeight + currentExpandedPanelHeight + currentHistoryChromeHeight;
  const totalCollapsedHeaderHeight =
    currentHomeChromeHeight + COLLAPSED_SELECTOR_HEIGHT + currentHistoryChromeHeight;

  const scrollY = useSharedValue(0);
  const collapseProgress = useDerivedValue(
    () => clamp(scrollY.value / collapseDistance, 0, 1),
    [collapseDistance, scrollY]
  );
  // useAnimatedScrollHandler (createAnimatedComponent) triggers flash-list's
  // getScrollableNode() which has an un-guarded null ref on RN New Architecture.
  // A plain JS callback writing to the shared value is safe: useDerivedValue /
  // useAnimatedStyle still run on the UI thread, only the ingestion is on JS.
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = Math.max(event.nativeEvent.contentOffset.y, 0);
    },
    [scrollY]
  );

  const handleHomeChromeLayout = useCallback(
    ({ nativeEvent }: LayoutChangeEvent) => {
      const measuredHeight = Math.ceil(nativeEvent.layout.height);

      setHomeChromeHeight((currentHeight) =>
        currentHeight === measuredHeight ? currentHeight : measuredHeight
      );
    },
    []
  );

  const handleExpandedSelectorLayout = useCallback(
    ({ nativeEvent }: LayoutChangeEvent) => {
      const measuredHeight = Math.ceil(nativeEvent.layout.height);

      setExpandedPanelHeight((currentHeight) =>
        currentHeight === measuredHeight ? currentHeight : measuredHeight
      );
    },
    []
  );

  const handleHistoryChromeLayout = useCallback(
    ({ nativeEvent }: LayoutChangeEvent) => {
      const measuredHeight = Math.ceil(nativeEvent.layout.height);

      setHistoryChromeHeight((currentHeight) =>
        currentHeight === measuredHeight ? currentHeight : measuredHeight
      );
    },
    []
  );

  useAnimatedReaction(
    () => collapseProgress.value >= COLLAPSED_PROGRESS,
    (isCollapsed, wasCollapsed) => {
      if (isCollapsed !== wasCollapsed) {
        runOnJS(setSelectorCollapsed)(isCollapsed);
      }
    },
    []
  );

  const panelAnimatedStyle = useAnimatedStyle(
    () => ({
      height: interpolate(
        collapseProgress.value,
        [0, 1],
        [currentExpandedPanelHeight, COLLAPSED_SELECTOR_HEIGHT],
        Extrapolation.CLAMP
      ),
      borderRadius: interpolate(collapseProgress.value, [0, 1], [28, 18]),
      overflow: "hidden",
    }),
    [currentExpandedPanelHeight]
  );

  const overlayAnimatedStyle = useAnimatedStyle(
    () => ({
      height:
        currentHomeChromeHeight +
        interpolate(
          collapseProgress.value,
          [0, 1],
          [currentExpandedPanelHeight, COLLAPSED_SELECTOR_HEIGHT],
          Extrapolation.CLAMP
        ) +
        currentHistoryChromeHeight,
    }),
    [currentExpandedPanelHeight, currentHistoryChromeHeight, currentHomeChromeHeight]
  );

  const expandedSelectorAnimatedStyle = useAnimatedStyle(
    () => {
      const easedProgress = interpolate(
        collapseProgress.value,
        [0, 0.5, 1],
        [0, 0.72, 1],
        Extrapolation.CLAMP
      );

      return {
        opacity: interpolate(
          easedProgress,
          [0, 0.55, 1],
          [1, 0.35, 0],
          Extrapolation.CLAMP
        ),
        transform: [
          {
            translateY: interpolate(
              easedProgress,
              [0, 1],
              [0, -32],
              Extrapolation.CLAMP
            ),
          },
          {
            scale: interpolate(easedProgress, [0, 1], [1, 0.96], Extrapolation.CLAMP),
          },
        ],
      };
    },
    []
  );

  const collapsedSelectorAnimatedStyle = useAnimatedStyle(
    () => {
      const easedProgress = interpolate(
        collapseProgress.value,
        [0, 0.5, 1],
        [0, 0.72, 1],
        Extrapolation.CLAMP
      );

      return {
        opacity: interpolate(easedProgress, [0.35, 1], [0, 1], Extrapolation.CLAMP),
        transform: [
          {
            translateY: interpolate(
              easedProgress,
              [0, 1],
              [18, 0],
              Extrapolation.CLAMP
            ),
          },
          {
            scale: interpolate(easedProgress, [0, 1], [0.98, 1], Extrapolation.CLAMP),
          },
        ],
      };
    },
    []
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

  const listContentContainerStyle = useMemo(
    () => ({
      paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
      paddingTop: totalExpandedHeaderHeight,
      paddingBottom: 100,
    }),
    [totalExpandedHeaderHeight]
  );
  const refreshIndicatorOffset = selectorCollapsed
    ? totalCollapsedHeaderHeight
    : totalExpandedHeaderHeight;

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900">
          <View className="flex-1">
            <FlashList
              data={moods}
              keyExtractor={keyExtractor}
              renderItem={renderMoodItem}
              ListEmptyComponent={listEmptyComponent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handlePullToRefresh}
                  progressViewOffset={refreshIndicatorOffset}
                  tintColor={isDark ? "#A8C5A8" : "#5B8A5B"}
                  colors={[isDark ? "#A8C5A8" : "#5B8A5B"]}
                  progressBackgroundColor={isDark ? "#2C4038" : "#FDFCFA"}
                />
              }
              style={{ flex: 1 }}
              contentInsetAdjustmentBehavior="automatic"
              showsVerticalScrollIndicator
              contentContainerStyle={listContentContainerStyle}
              scrollEventThrottle={16}
              onScroll={handleScroll}
            />

            <Animated.View
              pointerEvents="box-none"
              style={[
                overlayAnimatedStyle,
                {
                  backgroundColor: isDark ? "#1D2A24" : "#FDFCFA",
                  left: 0,
                  paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
                  position: "absolute",
                  right: 0,
                  top: 0,
                  zIndex: 10,
                },
              ]}
            >
              <View
                pointerEvents="none"
                onLayout={handleHomeChromeLayout}
                style={{ paddingTop: HEADER_TOP_PADDING }}
              >
                <HomeHeader />
              </View>

              <Animated.View style={panelAnimatedStyle}>
                {entrySettings.showDetailedLabels ? (
                  <>
                    <Animated.View
                      pointerEvents={selectorCollapsed ? "none" : "auto"}
                      onLayout={handleExpandedSelectorLayout}
                      style={expandedSelectorAnimatedStyle}
                    >
                      <DetailedMoodButtonSelector
                        onMoodPress={modals.handleMoodPress}
                        onLongPress={modals.handleLongPress}
                      />
                    </Animated.View>
                    <Animated.View
                      pointerEvents={selectorCollapsed ? "auto" : "none"}
                      style={[
                        collapsedSelectorAnimatedStyle,
                        {
                          bottom: 0,
                          height: COLLAPSED_SELECTOR_HEIGHT,
                          justifyContent: "center",
                          left: 0,
                          position: "absolute",
                          right: 0,
                        },
                      ]}
                    >
                      <CollapsedMoodSelector
                        isDark={isDark}
                        onMoodPress={modals.handleMoodPress}
                        onLongPress={modals.handleLongPress}
                      />
                    </Animated.View>
                  </>
                ) : (
                  <UnifiedMoodSelector
                    collapseProgress={collapseProgress}
                    isDark={isDark}
                    onMoodPress={modals.handleMoodPress}
                    onLongPress={modals.handleLongPress}
                  />
                )}
              </Animated.View>

              <View
                pointerEvents="none"
                onLayout={handleHistoryChromeLayout}
                style={{ paddingTop: HEADER_SECTION_GAP }}
              >
                <HistoryListHeader moodCount={moods.length} />
              </View>
            </Animated.View>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>

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
    </>
  );
}

interface CollapsedMoodSelectorProps {
  isDark: boolean;
  onMoodPress: (mood: number) => void;
  onLongPress: (mood: number) => void;
}

const PILL_WIDTH = 52;
const PILL_HEIGHT = 38;
const PILL_GAP = 5;
const TRACK_PADDING_X = 8;
const CENTER_INDEX = 5;

function CollapsedMoodSelector({
  isDark,
  onMoodPress,
  onLongPress,
}: CollapsedMoodSelectorProps) {
  const scrollRef = useRef<RNScrollView>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  const contentWidth =
    TRACK_PADDING_X * 2 +
    moodScale.length * PILL_WIDTH +
    (moodScale.length - 1) * PILL_GAP;

  useEffect(() => {
    if (trackWidth <= 0) return;
    if (contentWidth <= trackWidth) return;

    const targetCenter =
      TRACK_PADDING_X +
      CENTER_INDEX * (PILL_WIDTH + PILL_GAP) +
      PILL_WIDTH / 2;
    const maxScroll = contentWidth - trackWidth;
    const x = Math.max(0, Math.min(maxScroll, targetCenter - trackWidth / 2));

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x, y: 0, animated: false });
    });
  }, [trackWidth, contentWidth]);

  const fitsWithoutScroll = contentWidth <= trackWidth;

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)}
      style={{
        backgroundColor: isDark ? "#2C4038" : "#FDFCFA",
        borderWidth: 1,
        borderColor: isDark ? "#3A5448" : "#E5D9BF",
        borderRadius: 18,
        shadowColor: isDark ? "#000" : "#9D8660",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.22 : 0.08,
        shadowRadius: 8,
        elevation: 3,
        overflow: "hidden",
      }}
    >
      <RNScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        contentContainerStyle={{
          flexGrow: fitsWithoutScroll ? 1 : undefined,
          justifyContent: fitsWithoutScroll ? "center" : "flex-start",
          alignItems: "center",
          paddingHorizontal: TRACK_PADDING_X,
          paddingVertical: 6,
          gap: PILL_GAP,
        }}
      >
        {moodScale.map((mood) => {
          const backgroundColor = isDark ? mood.bgHexDark : mood.bgHex;
          const color = isDark ? mood.textHexDark : mood.textHex;

          return (
            <HapticTab
              key={mood.value}
              className="items-center justify-center"
              style={{
                width: PILL_WIDTH,
                height: PILL_HEIGHT,
                backgroundColor,
                borderRadius: 12,
              }}
              onPress={() => onMoodPress(mood.value)}
              onLongPress={() => onLongPress(mood.value)}
              delayLongPress={500}
              accessibilityRole="button"
              accessibilityLabel={`Log ${mood.label}, mood ${mood.value}`}
            >
              <Text
                style={{
                  color,
                  fontSize: 14,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                  letterSpacing: -0.2,
                }}
              >
                {mood.value}
              </Text>
            </HapticTab>
          );
        })}
      </RNScrollView>
    </View>
  );
}

export default function HomeScreen() {
  return (
    <ErrorBoundary FallbackComponent={HomeErrorFallback}>
      <HomeScreenContent />
    </ErrorBoundary>
  );
}
