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
import { Ionicons } from "@expo/vector-icons";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
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
import { ScreenBackgroundAccent } from "@/components/layout/ScreenBackgroundAccent";
import { TabSceneTransition } from "@/components/ui/TabSceneTransition";
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
import { haptics } from "@/lib/haptics";
import { getHomeHeaderSnapTarget } from "@/lib/homeHeaderSnap";
import { addHomeTabDoublePressListener } from "@/lib/homeTabEvents";

import type { MoodEntry } from "@db/types";
import {
  getAllMoodRatingDisplays,
  getNeutralMoodRating,
} from "@/constants/moodScaleInterpretation";

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
const HOME_LIST_DRAW_DISTANCE = 900;
const JUMP_TO_TOP_THRESHOLD = 760;
// Light low-pass smoothing applied to the (JS-thread ingested) scroll position
// before it drives the collapse animation. Long enough to absorb dropped frames
// and jitter, short enough to still feel tied to the finger.
const COLLAPSE_SMOOTHING_MS = 90;
// Duration of the programmatic "return to start" header expansion.
const SCROLL_TO_TOP_MS = 360;
const HEADER_SNAP_MS = 220;
const HEADER_SNAP_DELAY_MS = 80;
// FlashList briefly preserves the old anchor after prepending a new entry.
// These retries make the explicit post-save jump-to-top win after that settles.
const POST_SAVE_SCROLL_RESET_DELAYS_MS = [140, 320];

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

function HomeScreenContent() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const moods = useMoodsStore((state) => state.moods);
  const status = useMoodsStore((state) => state.status);
  const loadAll = useMoodsStore((state) => state.loadAll);
  const refreshMoods = useMoodsStore((state) => state.refreshMoods);
  const createMood = useMoodsStore((state) => state.create);
  const updateMood = useMoodsStore((state) => state.update);
  const updateMoodTimestamp = useMoodsStore((state) => state.updateTimestamp);

  const loading = status === "loading";
  const [homeChromeHeight, setHomeChromeHeight] = useState(0);
  const [expandedPanelHeight, setExpandedPanelHeight] = useState(0);
  const [historyChromeHeight, setHistoryChromeHeight] = useState(0);
  const [selectorCollapsed, setSelectorCollapsed] = useState(false);
  const [jumpToTopVisible, setJumpToTopVisible] = useState(false);
  const listRef = useRef<FlashListRef<MoodEntry>>(null);
  const latestScrollMetricsRef = useRef({
    offsetY: 0,
    contentHeight: 0,
    viewportHeight: 0,
  });
  const pendingHeaderSnapRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const pendingTopResetTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const momentumScrollActiveRef = useRef(false);
  const { refreshing, onRefresh: handlePullToRefresh } = usePullToRefresh(refreshMoods);

  const entrySettings = useEntrySettings();
  const modals = useMoodModals();
  const itemActions = useMoodItemActions({
    setEditingEntry: modals.setEditingEntry,
  });

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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
  const rawCollapseProgress = useDerivedValue(
    () => clamp(scrollY.value / collapseDistance, 0, 1),
    [collapseDistance, scrollY]
  );
  // Easing the raw scroll-driven progress on the UI thread smooths out the
  // jitter introduced by ingesting scroll offsets on the JS thread (see the
  // handleScroll comment). withTiming re-targets every frame, acting as a
  // low-pass filter rather than a discrete animation. Every visual style and
  // reaction reads this value so the whole collapse moves as one.
  const collapseProgress = useDerivedValue(
    () =>
      withTiming(rawCollapseProgress.value, {
        duration: COLLAPSE_SMOOTHING_MS,
        easing: Easing.out(Easing.quad),
      }),
    [rawCollapseProgress]
  );

  const clearPendingHeaderSnap = useCallback(() => {
    if (pendingHeaderSnapRef.current === null) return;

    clearTimeout(pendingHeaderSnapRef.current);
    pendingHeaderSnapRef.current = null;
  }, []);

  const clearPendingTopResets = useCallback(() => {
    pendingTopResetTimersRef.current.forEach(clearTimeout);
    pendingTopResetTimersRef.current = [];
  }, []);

  useEffect(
    () => () => {
      clearPendingHeaderSnap();
      clearPendingTopResets();
    },
    [clearPendingHeaderSnap, clearPendingTopResets]
  );

  const forceHomeListToTop = useCallback(
    (animated: boolean) => {
      clearPendingHeaderSnap();
      momentumScrollActiveRef.current = false;
      latestScrollMetricsRef.current = {
        ...latestScrollMetricsRef.current,
        offsetY: 0,
      };
      setJumpToTopVisible(false);
      listRef.current?.scrollToOffset({ offset: 0, animated });

      if (animated) {
        scrollY.value = withTiming(0, {
          duration: SCROLL_TO_TOP_MS,
          easing: Easing.out(Easing.cubic),
        });
      } else {
        scrollY.value = 0;
      }

      setSelectorCollapsed(false);
    },
    [clearPendingHeaderSnap, scrollY]
  );

  const schedulePostSaveTopResets = useCallback(() => {
    clearPendingTopResets();

    pendingTopResetTimersRef.current = POST_SAVE_SCROLL_RESET_DELAYS_MS.map((delayMs) => {
      const timerId = setTimeout(() => {
        pendingTopResetTimersRef.current =
          pendingTopResetTimersRef.current.filter((currentId) => currentId !== timerId);
        forceHomeListToTop(false);
      }, delayMs);

      return timerId;
    });
  }, [clearPendingTopResets, forceHomeListToTop]);

  const snapHomeHeaderIfNeeded = useCallback(() => {
    clearPendingHeaderSnap();

    const targetOffset = getHomeHeaderSnapTarget({
      ...latestScrollMetricsRef.current,
      collapseDistance,
    });

    if (targetOffset === null) return;

    latestScrollMetricsRef.current = {
      ...latestScrollMetricsRef.current,
      offsetY: targetOffset,
    };
    listRef.current?.scrollToOffset({ offset: targetOffset, animated: true });
    scrollY.value = withTiming(targetOffset, {
      duration: HEADER_SNAP_MS,
      easing: Easing.out(Easing.cubic),
    });

    if (targetOffset === 0) {
      setSelectorCollapsed(false);
    }
  }, [clearPendingHeaderSnap, collapseDistance, scrollY]);

  const scheduleHomeHeaderSnap = useCallback(() => {
    clearPendingHeaderSnap();

    pendingHeaderSnapRef.current = setTimeout(() => {
      pendingHeaderSnapRef.current = null;

      if (!momentumScrollActiveRef.current) {
        snapHomeHeaderIfNeeded();
      }
    }, HEADER_SNAP_DELAY_MS);
  }, [clearPendingHeaderSnap, snapHomeHeaderIfNeeded]);

  // useAnimatedScrollHandler (createAnimatedComponent) triggers flash-list's
  // getScrollableNode() which has an un-guarded null ref on RN New Architecture.
  // A plain JS callback writing to the shared value is safe: useDerivedValue /
  // useAnimatedStyle still run on the UI thread, only the ingestion is on JS.
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = Math.max(event.nativeEvent.contentOffset.y, 0);
      latestScrollMetricsRef.current = {
        offsetY,
        contentHeight: event.nativeEvent.contentSize.height,
        viewportHeight: event.nativeEvent.layoutMeasurement.height,
      };
      scrollY.value = offsetY;
    },
    [scrollY]
  );

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleScroll(event);
      scheduleHomeHeaderSnap();
    },
    [handleScroll, scheduleHomeHeaderSnap]
  );

  const handleScrollBeginDrag = useCallback(() => {
    clearPendingTopResets();
  }, [clearPendingTopResets]);

  const handleMomentumScrollBegin = useCallback(() => {
    momentumScrollActiveRef.current = true;
    clearPendingHeaderSnap();
  }, [clearPendingHeaderSnap]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleScroll(event);
      momentumScrollActiveRef.current = false;
      snapHomeHeaderIfNeeded();
    },
    [handleScroll, snapHomeHeaderIfNeeded]
  );

  const scrollHomeListToTop = useCallback(
    (options?: { refresh?: boolean; haptic?: boolean }) => {
      if (options?.haptic !== false) {
        haptics.selection();
      }

      clearPendingTopResets();
      forceHomeListToTop(true);

      if (options?.refresh) {
        void handlePullToRefresh();
      }
    },
    [clearPendingTopResets, forceHomeListToTop, handlePullToRefresh]
  );

  const handleEntrySave = useCallback(async (values: MoodEntryFormValues) => {
    await createMood({
      mood: values.mood,
      note: values.note || null,
      emotions: values.emotions,
      contextTags: values.contextTags,
      energy: values.energy,
    });

    scrollHomeListToTop({ haptic: false });
    schedulePostSaveTopResets();
  }, [createMood, schedulePostSaveTopResets, scrollHomeListToTop]);

  const handleJumpToTopPress = useCallback(() => {
    // HapticTab fires its own press feedback, so skip the duplicate buzz here.
    scrollHomeListToTop({ haptic: false });
  }, [scrollHomeListToTop]);

  const handleHomeTabDoublePress = useCallback(() => {
    scrollHomeListToTop({ haptic: false, refresh: true });
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

  useAnimatedReaction(
    () => collapseProgress.value >= COLLAPSED_PROGRESS,
    (isCollapsed, wasCollapsed) => {
      if (isCollapsed !== wasCollapsed) {
        runOnJS(setSelectorCollapsed)(isCollapsed);
      }
    },
    []
  );

  useAnimatedReaction(
    () => scrollY.value > JUMP_TO_TOP_THRESHOLD,
    (isVisible, wasVisible) => {
      if (isVisible !== wasVisible) {
        runOnJS(setJumpToTopVisible)(isVisible);
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
  const jumpButtonBottomOffset = Math.max(insets.bottom, 8) + 76;
  const jumpButtonStyle = useMemo(
    () => ({
      alignItems: "center" as const,
      backgroundColor: isDark ? "#A6E39B" : "#5B8A5B",
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
              keyExtractor={keyExtractor}
              renderItem={renderMoodItem}
              ListEmptyComponent={listEmptyComponent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handlePullToRefresh}
                  progressViewOffset={refreshIndicatorOffset}
                  tintColor={isDark ? "#A6E39B" : "#5B8A5B"}
                  colors={[isDark ? "#A6E39B" : "#5B8A5B"]}
                  progressBackgroundColor={isDark ? "#14251C" : "#FDFCFA"}
                />
              }
              style={{ flex: 1 }}
              contentInsetAdjustmentBehavior="automatic"
              showsVerticalScrollIndicator
              contentContainerStyle={listContentContainerStyle}
              drawDistance={HOME_LIST_DRAW_DISTANCE}
              scrollEventThrottle={16}
              onScroll={handleScroll}
              onScrollBeginDrag={handleScrollBeginDrag}
              onScrollEndDrag={handleScrollEndDrag}
              onMomentumScrollBegin={handleMomentumScrollBegin}
              onMomentumScrollEnd={handleMomentumScrollEnd}
            />

            <Animated.View
              pointerEvents="box-none"
              style={[
                overlayAnimatedStyle,
                {
                  backgroundColor: isDark ? "#08150F" : "#FAF8F4",
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
                <HapticTab
                  accessibilityHint="Scrolls the recent entries list back to the top"
                  accessibilityLabel="Jump to top"
                  accessibilityRole="button"
                  onPress={handleJumpToTopPress}
                  style={jumpButtonStyle}
                >
                  <Ionicons
                    name="arrow-up"
                    size={23}
                    color={isDark ? "#08150F" : "#FDFCFA"}
                  />
                </HapticTab>
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
const PILL_STEP = PILL_WIDTH + PILL_GAP;
const TRACK_EDGE_INSET = 16;
const CENTER_INDEX = getNeutralMoodRating();
const MIN_VISIBLE_PILLS = 4;
const MAX_VISIBLE_PILLS = 7;
const MOOD_RATING_COUNT = getAllMoodRatingDisplays(false).length;

function CollapsedMoodSelector({
  isDark,
  onMoodPress,
  onLongPress,
}: CollapsedMoodSelectorProps) {
  const scrollRef = useRef<RNScrollView>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const moodData = useMemo(() => getAllMoodRatingDisplays(isDark), [isDark]);

  // Size the scroll viewport to fit a whole number of pills with NO horizontal
  // padding inside. Combined with snap-to-start, this guarantees every resting
  // position shows full pills only — no partial-pill slivers at the edges to
  // mask. Anything outside this exact width becomes solid container background,
  // which is visually quiet.
  const availableScrollWidth = Math.max(0, trackWidth - TRACK_EDGE_INSET * 2);
  const visiblePills =
    availableScrollWidth > 0
      ? Math.max(
          MIN_VISIBLE_PILLS,
          Math.min(
            MAX_VISIBLE_PILLS,
            Math.floor((availableScrollWidth + PILL_GAP) / PILL_STEP)
          )
        )
      : MIN_VISIBLE_PILLS;
  const scrollAreaWidth = visiblePills * PILL_STEP - PILL_GAP;
  const fits = scrollAreaWidth >= MOOD_RATING_COUNT * PILL_STEP - PILL_GAP;

  useEffect(() => {
    if (trackWidth <= 0 || fits) return;

    // Position CENTER_INDEX as centered as possible inside the visible slot.
    const leftmostIndex = Math.max(
      0,
      Math.min(
        MOOD_RATING_COUNT - visiblePills,
        CENTER_INDEX - Math.floor(visiblePills / 2)
      )
    );
    const x = leftmostIndex * PILL_STEP;

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x, y: 0, animated: false });
    });
  }, [trackWidth, fits, visiblePills]);

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)}
      style={{
        backgroundColor: isDark ? "#14251C" : "#FDFCFA",
        borderWidth: 1,
        borderColor: isDark ? "#2F513B" : "#E5D9BF",
        borderRadius: 18,
        shadowColor: isDark ? "#09130E" : "#9D8660",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.22 : 0.08,
        shadowRadius: 8,
        elevation: 3,
        overflow: "hidden",
        paddingHorizontal: TRACK_EDGE_INSET,
        paddingVertical: 6,
      }}
    >
      <RNScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={fits ? undefined : PILL_STEP}
        snapToAlignment="start"
        disableIntervalMomentum
        removeClippedSubviews
        style={{
          width: "100%",
          flexGrow: 0,
          flexShrink: 0,
          overflow: "hidden",
        }}
        contentContainerStyle={{
          flexGrow: fits ? 1 : undefined,
          justifyContent: fits ? "center" : "flex-start",
          alignItems: "center",
          gap: PILL_GAP,
        }}
      >
        {moodData.map((mood) => {
          return (
            <HapticTab
              key={mood.value}
              className="items-center justify-center"
              style={{
                width: PILL_WIDTH,
                height: PILL_HEIGHT,
                backgroundColor: mood.backgroundHex,
                borderRadius: 12,
              }}
              onPress={() => onMoodPress(mood.value)}
              onLongPress={() => onLongPress(mood.value)}
              delayLongPress={500}
              accessibilityRole="button"
              accessibilityLabel={mood.accessibilityText}
            >
              <Text
                style={{
                  color: mood.colorHex,
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
      <TabSceneTransition>
        <HomeScreenContent />
      </TabSceneTransition>
    </ErrorBoundary>
  );
}
