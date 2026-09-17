import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Pressable,
  RefreshControl,
  ScrollView as RNScrollView,
  type LayoutChangeEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createScreenErrorFallback } from "@/components/ScreenErrorFallback";
import { DateTimePickerModal } from "@/components/DateTimePickerModal";
import {
  DetailedMoodEntryModal,
  EditMoodEntryModal,
  MoodEntryFormValues,
  QuickMoodEntryModal,
} from "@/components/MoodEntryModal";
import { DisplayMoodItem } from "@/components/DisplayMoodItem";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenBackgroundAccent } from "@/components/layout/ScreenBackgroundAccent";
import { TabSceneTransition } from "@/components/ui/TabSceneTransition";
import {
  DetailedMoodButtonSelector,
  HomeHeader,
  HistoryListHeader,
  CollapsedMoodSelector,
  UnifiedMoodSelector,
  UNIFIED_COMPACT_EXPANDED_HEIGHT,
} from "@/components/home";

import { ActiveFilterChips } from "@/features/history/ActiveFilterChips";
import { HistoryFilterSheet } from "@/features/history/HistoryFilterSheet";
import { useMoodsStore } from "@/shared/state/moodsStore";
import { useEntrySettings } from "@/hooks/useEntrySettings";
import { useMoodModals } from "@/hooks/useMoodModals";
import { useMoodItemActions } from "@/hooks/useMoodItemActions";
import { useColorScheme } from "@/hooks/useColorScheme";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import {
  HOME_COLLAPSED_SELECTOR_HEIGHT,
  useHomeHeaderCollapse,
} from "@/hooks/useHomeHeaderCollapse";
import { haptics } from "@/lib/haptics";
import { addHomeTabDoublePressListener } from "@/lib/homeTabEvents";
import {
  commitThenRunPostCommitEffects,
  getMoodEntryPersistenceValues,
  updateMoodEntryOrThrow,
  updateMoodTimestampOrThrow,
} from "@/lib/moodEntryPersistence";

import type { MoodEntry } from "@db/types";
import { getThemedColor } from "@/constants/colors";

const HomeErrorFallback = createScreenErrorFallback("Home");
const DEFAULT_DETAILED_PANEL_HEIGHT = 484;
const HEADER_TOP_PADDING = 16;
const HEADER_SECTION_GAP = 16;
const CONTENT_HORIZONTAL_PADDING = 16;
const ESTIMATED_HOME_CHROME_HEIGHT = 72;
const ESTIMATED_HISTORY_CHROME_HEIGHT = 56;
const HOME_LIST_DRAW_DISTANCE = 900;

function HomeScreenContent() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const filters = useMoodsStore((state) => state.filters);
  const clearFilters = useMoodsStore((state) => state.clearFilters);
  const total = useMoodsStore((state) => state.total);
  const loadMore = useMoodsStore((state) => state.loadMore);
  const loadingMore = useMoodsStore((state) => state.loadingMore);
  const moods = useMoodsStore((state) => state.moods);
  const status = useMoodsStore((state) => state.status);
  const error = useMoodsStore((state) => state.error);
  const loadAll = useMoodsStore((state) => state.loadAll);
  const ensureFresh = useMoodsStore((state) => state.ensureFresh);
  const refreshMoods = useMoodsStore((state) => state.refreshMoods);
  const createMood = useMoodsStore((state) => state.create);
  const updateMood = useMoodsStore((state) => state.update);
  const updateMoodTimestamp = useMoodsStore((state) => state.updateTimestamp);

  const loading = status === "loading";
  const [homeChromeHeight, setHomeChromeHeight] = useState(0);
  const [expandedPanelHeight, setExpandedPanelHeight] = useState(0);
  const [historyChromeHeight, setHistoryChromeHeight] = useState(0);
  const listRef = useRef<FlashListRef<MoodEntry>>(null);
  const { refreshing, onRefresh: handlePullToRefresh } = usePullToRefresh(refreshMoods);

  const entrySettings = useEntrySettings();
  const modals = useMoodModals();
  const itemActions = useMoodItemActions({
    setEditingEntry: modals.setEditingEntry,
  });

  useFocusEffect(
    useCallback(() => {
      void ensureFresh();
    }, [ensureFresh])
  );

  const handleEditEntrySave = useCallback(
    async (values: MoodEntryFormValues) => {
      if (!modals.editingEntry) return;
      await updateMoodEntryOrThrow(
        updateMood,
        modals.editingEntry.id,
        values,
      );
    },
    [modals.editingEntry, updateMood]
  );

  const handleDateTimeSave = useCallback(
    async (moodId: number, newTimestamp: number, utcOffsetMinutes?: number | null) => {
      await updateMoodTimestampOrThrow(
        updateMoodTimestamp,
        moodId,
        newTimestamp,
        utcOffsetMinutes,
      );
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
        onPress={modals.openDateModal}
        onLongPress={handleMoodItemLongPress}
        onEdit={modals.setEditingEntry}
        onDelete={itemActions.handleDeleteMood}
        swipeThreshold={itemActions.SWIPE_THRESHOLD}
      />
    ),
    [handleMoodItemLongPress, itemActions, modals]
  );

  const estimatedExpandedPanelHeight = entrySettings.showDetailedLabels
    ? DEFAULT_DETAILED_PANEL_HEIGHT
    : UNIFIED_COMPACT_EXPANDED_HEIGHT;
  const currentExpandedPanelHeight = expandedPanelHeight || estimatedExpandedPanelHeight;
  const currentHomeChromeHeight = homeChromeHeight || ESTIMATED_HOME_CHROME_HEIGHT;
  const currentHistoryChromeHeight = historyChromeHeight || ESTIMATED_HISTORY_CHROME_HEIGHT;
  const totalExpandedHeaderHeight =
    currentHomeChromeHeight + currentExpandedPanelHeight + currentHistoryChromeHeight;
  const totalCollapsedHeaderHeight =
    currentHomeChromeHeight +
    HOME_COLLAPSED_SELECTOR_HEIGHT +
    currentHistoryChromeHeight;

  const {
    selectorCollapsed,
    jumpToTopVisible,
    collapseProgress,
    scrollToTop,
    schedulePostSaveTopResets,
    scrollHandlers,
    panelAnimatedStyle,
    overlayAnimatedStyle,
    expandedSelectorAnimatedStyle,
    collapsedSelectorAnimatedStyle,
  } = useHomeHeaderCollapse({
    listRef,
    expandedPanelHeight: currentExpandedPanelHeight,
    homeChromeHeight: currentHomeChromeHeight,
    historyChromeHeight: currentHistoryChromeHeight,
  });

  const scrollHomeListToTop = useCallback(
    (options?: { refresh?: boolean }) => {
      scrollToTop();
      if (options?.refresh) {
        void handlePullToRefresh();
      }
    },
    [handlePullToRefresh, scrollToTop]
  );

  const handleEntrySave = useCallback(async (values: MoodEntryFormValues) => {
    await commitThenRunPostCommitEffects(
      () => createMood(getMoodEntryPersistenceValues(values)),
      [scrollHomeListToTop, schedulePostSaveTopResets],
    );
  }, [createMood, schedulePostSaveTopResets, scrollHomeListToTop]);

  const handleJumpToTopPress = useCallback(() => {
    haptics.tap();
    scrollHomeListToTop();
  }, [scrollHomeListToTop]);

  const handleHomeTabDoublePress = useCallback(() => {
    scrollHomeListToTop({ refresh: true });
  }, [scrollHomeListToTop]);

  useEffect(() => {
    return addHomeTabDoublePressListener(handleHomeTabDoublePress);
  }, [handleHomeTabDoublePress]);

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

  const listEmptyComponent = useMemo(
    () =>
      loading ? (
        <LoadingSpinner message="Loading..." />
      ) : status === "error" ? (
        <EmptyState
          icon="warning-outline"
          tone="coral"
          title="Mood history could not load"
          description={error ?? "Your local mood history is still on this device. Try loading it again."}
          actionLabel="Try Again"
          onAction={() => {
            void loadAll();
          }}
        />
      ) : Object.keys(filters).length ? (
        <EmptyState icon="search-outline" tone="sage" title="No matching entries" description="Try changing or clearing your filters." actionLabel="Clear filters" onAction={() => { void clearFilters(); }} />
      ) : (
        <EmptyState
          icon="leaf-outline"
          tone="sage"
          title="Start your journey"
          description="Tap a mood above to log how you're feeling right now"
        />
      ),
    [clearFilters, error, filters, loadAll, loading, status]
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
  const jumpButtonBottomOffset = Math.max(insets.bottom, 8) + 76;
  const jumpButtonStyle = useMemo(
    () => ({
      alignItems: "center" as const,
      backgroundColor: getThemedColor("primary", isDark),
      borderColor: isDark
        ? "rgba(8, 21, 15, 0.24)"
        : "rgba(253, 252, 250, 0.72)",
      borderRadius: 24,
      borderWidth: 1,
      elevation: 4,
      height: 48,
      justifyContent: "center" as const,
      shadowColor: isDark ? "#000000" : "#9D8660",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.28 : 0.16,
      shadowRadius: 10,
      width: 48,
    }),
    [isDark]
  );

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900">
          <View className="flex-1">
            <FlashList
              ref={listRef}
              // FlashList v2 defaults to Animated.ScrollView and then wraps it
              // again in Animated.createAnimatedComponent. On the New
              // Architecture that double-wrap leaves the internal scroll ref
              // null, so every programmatic scroll (scrollToOffset/scrollToTop —
              // the jump-to-top button and double-tap-home) silently no-ops.
              // Supplying a plain ScrollView keeps it a single wrap and restores
              // a working native scroll ref.
              renderScrollComponent={RNScrollView}
              data={moods}
              onEndReached={() => { void loadMore(); }}
              onEndReachedThreshold={0.4}
              ListFooterComponent={loadingMore ? <LoadingSpinner message="Loading more..." /> : error && moods.length > 0 ? (
                <EmptyState icon="warning-outline" tone="coral" title="History could not load" description={error} actionLabel="Try again" onAction={() => { void refreshMoods(); }} />
              ) : null}
              keyExtractor={keyExtractor}
              renderItem={renderMoodItem}
              ListEmptyComponent={listEmptyComponent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handlePullToRefresh}
                  progressViewOffset={refreshIndicatorOffset}
                  tintColor={getThemedColor("primary", isDark)}
                  colors={[getThemedColor("primary", isDark)]}
                  progressBackgroundColor={getThemedColor("surface", isDark)}
                />
              }
              style={{ flex: 1 }}
              contentInsetAdjustmentBehavior="automatic"
              showsVerticalScrollIndicator
              contentContainerStyle={listContentContainerStyle}
              drawDistance={HOME_LIST_DRAW_DISTANCE}
              scrollEventThrottle={16}
              {...scrollHandlers}
            />

            <Animated.View
              pointerEvents="box-none"
              style={[
                overlayAnimatedStyle,
                {
                  backgroundColor: getThemedColor("background", isDark),
                  left: 0,
                  paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
                  position: "absolute",
                  right: 0,
                  top: 0,
                  zIndex: 10,
                },
              ]}
            >
              <ScreenBackgroundAccent density="compact" />
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
                          height: HOME_COLLAPSED_SELECTOR_HEIGHT,
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
                pointerEvents="auto"
                onLayout={handleHistoryChromeLayout}
                style={{ paddingTop: HEADER_SECTION_GAP }}
              >
                <View className="mb-3 flex-row items-center justify-between gap-2">
                  <View className="flex-1"><HistoryListHeader moodCount={total} /></View>
                  <HistoryFilterSheet />
                </View>
                <ActiveFilterChips />
              </View>
            </Animated.View>

            {jumpToTopVisible ? (
              <View
                style={{
                  alignItems: "center",
                  bottom: jumpButtonBottomOffset,
                  elevation: 8,
                  height: 56,
                  justifyContent: "center",
                  position: "absolute",
                  right: 18,
                  width: 56,
                  zIndex: 20,
                }}
              >
                <Pressable
                  accessibilityHint="Scrolls the recent entries list back to the top"
                  accessibilityLabel="Jump to top"
                  accessibilityRole="button"
                  onPress={handleJumpToTopPress}
                  style={jumpButtonStyle}
                >
                  <Ionicons
                    name="arrow-up"
                    size={23}
                    color="#08150F"
                  />
                </Pressable>
              </View>
            ) : null}
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>

      {modals.showDateModal && (
        <DateTimePickerModal
          visible={modals.showDateModal}
          mood={modals.selectedMood}
          onClose={modals.closeDateModal}
          onSave={handleDateTimeSave}
          onEdit={(mood) => {
            modals.closeDateModal();
            modals.setEditingEntry(mood);
          }}
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
        onCreateEmotion={entrySettings.createEmotionOption}
        onCreateContextTag={entrySettings.createContextOption}
      />
      <DetailedMoodEntryModal
        visible={modals.detailedEntryVisible}
        initialMood={modals.pendingMood}
        emotionOptions={entrySettings.emotionOptions}
        contextOptions={entrySettings.contextOptions}
        fieldConfig={entrySettings.detailedFieldConfig}
        onClose={modals.closeDetailedEntry}
        onSubmit={handleEntrySave}
        onCreateEmotion={entrySettings.createEmotionOption}
        onCreateContextTag={entrySettings.createContextOption}
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
        onCreateEmotion={entrySettings.createEmotionOption}
        onCreateContextTag={entrySettings.createContextOption}
      />
    </>
  );
}

export default function HomeScreen() {
  return (
    <ErrorBoundary FallbackComponent={HomeErrorFallback}>
      <TabSceneTransition>
        <HomeScreenContent />
      </TabSceneTransition>
    </ErrorBoundary>
  );
}
