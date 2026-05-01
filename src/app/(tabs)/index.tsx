import React, { useEffect, useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  type LayoutChangeEvent,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ToastManager from "toastify-react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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
  UnifiedMoodSelector,
  UNIFIED_COMPACT_EXPANDED_HEIGHT,
} from "@/components/home";

import { useMoodsStore } from "@/shared/state/moodsStore";
import { useEntrySettings } from "@/hooks/useEntrySettings";
import { useMoodModals } from "@/hooks/useMoodModals";
import { useMoodItemActions } from "@/hooks/useMoodItemActions";
import { useColorScheme } from "@/hooks/useColorScheme";

import type { MoodEntry } from "@db/types";
import { Toast } from "toastify-react-native";
import { moodService } from "@/services/moodService";
import { emotionService } from "@/services/emotionService";
import { moodScale } from "@/constants/moodScale";

const HomeErrorFallback = createScreenErrorFallback("Home");
const COLLAPSED_SELECTOR_HEIGHT = 60;
const DEFAULT_COMPACT_PANEL_HEIGHT = 212;
const DEFAULT_DETAILED_PANEL_HEIGHT = 524;
const MIN_COLLAPSE_DISTANCE = 80;
const SNAP_VELOCITY = 900;
const REFRESH_PULL_DISTANCE = 86;

function UndoToastAction({
  isDark,
  onPress,
}: {
  isDark: boolean;
  onPress: () => void;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(1, {
      damping: 16,
      stiffness: 220,
      mass: 0.8,
    });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [10, 0], Extrapolation.CLAMP) },
      { scale: interpolate(progress.value, [0, 1], [0.92, 1], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <HapticTab onPress={onPress}>
      <Animated.View
        style={animatedStyle}
        className="ml-2 rounded-xl px-3 py-2"
      >
        <View
          className="rounded-xl px-3 py-2"
          style={{
            backgroundColor: isDark ? "#2D3D2D" : "#E8EFE8",
            borderWidth: 1,
            borderColor: isDark ? "#5E7C69" : "#B7CDB7",
          }}
        >
          <Text
            className="font-semibold text-sm"
            style={{ color: isDark ? "#A8C5A8" : "#5B8A5B" }}
          >
            Undo
          </Text>
        </View>
      </Animated.View>
    </HapticTab>
  );
}

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
        backgroundColor: isDark ? "#2C4038" : "#FDFCFA",
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
        <UndoToastAction isDark={isDark} onPress={onPress} />
      </View>
      <HapticTab onPress={hide} className="ml-2">
        <IconSymbol name="xmark" size={18} color={isDark ? "#8AAE98" : "#7A6B55"} />
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
  const [expandedPanelHeight, setExpandedPanelHeight] = useState(0);
  const [selectorCollapsed, setSelectorCollapsed] = useState(true);
  const collapseProgress = useSharedValue(1);
  const dragStartProgress = useSharedValue(0);
  const listY = useSharedValue(0);

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
      await moodService.updateTimestamp(moodId, newTimestamp);
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

  const estimatedExpandedPanelHeight = entrySettings.showDetailedLabels
    ? DEFAULT_DETAILED_PANEL_HEIGHT
    : UNIFIED_COMPACT_EXPANDED_HEIGHT;
  const currentExpandedPanelHeight = expandedPanelHeight || estimatedExpandedPanelHeight;
  const collapseDistance = Math.max(
    currentExpandedPanelHeight - COLLAPSED_SELECTOR_HEIGHT,
    MIN_COLLAPSE_DISTANCE
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

  const handleListScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      listY.value = Math.max(event.nativeEvent.contentOffset.y, 0);
    },
    [listY]
  );

  const triggerExpandedRefresh = useCallback(() => {
    if (!refreshing) {
      refreshMoods();
    }
  }, [refreshMoods, refreshing]);

  useAnimatedReaction(
    () => collapseProgress.value >= 0.995,
    (isCollapsed, wasCollapsed) => {
      if (isCollapsed !== wasCollapsed) {
        runOnJS(setSelectorCollapsed)(isCollapsed);
      }
    },
    []
  );

  const resolveSnap = useCallback((progress: number, velocityY: number) => {
    "worklet";

    if (velocityY < -SNAP_VELOCITY) return 1;
    if (velocityY > SNAP_VELOCITY) return 0;
    if (progress < 0.38) return 0;
    if (progress > 0.62) return 1;

    return velocityY < 0 ? 1 : 0;
  }, []);

  const entriesNativeGesture = useMemo(() => Gesture.Native(), []);

  const handoffGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-8, 8])
        .simultaneousWithExternalGesture(entriesNativeGesture)
        .onBegin(() => {
          dragStartProgress.value = collapseProgress.value;
        })
        .onUpdate((event) => {
          const draggingDown = event.translationY > 0;
          const draggingUp = event.translationY < 0;

          // While collapsed, regular upward scrolling belongs to the list.
          // The selector only opens from a downward edge pull when the list is
          // already at the top and cannot move further.
          if (dragStartProgress.value >= 0.999 && draggingUp) {
            return;
          }

          if (draggingDown && listY.value > 0) {
            return;
          }

          const nextProgress =
            dragStartProgress.value - event.translationY / collapseDistance;

          collapseProgress.value = Math.min(Math.max(nextProgress, 0), 1);
        })
        .onEnd((event) => {
          const shouldRefresh =
            collapseProgress.value <= 0.001 &&
            dragStartProgress.value <= 0.001 &&
            event.translationY > REFRESH_PULL_DISTANCE &&
            event.velocityY > 0;

          if (shouldRefresh) {
            runOnJS(triggerExpandedRefresh)();
          }

          const target = resolveSnap(collapseProgress.value, event.velocityY);
          collapseProgress.value = withSpring(target, {
            damping: 24,
            stiffness: 220,
            mass: 0.9,
          });
        }),
    [
      collapseDistance,
      collapseProgress,
      dragStartProgress,
      entriesNativeGesture,
      listY,
      resolveSnap,
      triggerExpandedRefresh,
    ]
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
      paddingBottom: 100,
    }),
    []
  );

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView
          className="flex-1 bg-paper-100 dark:bg-paper-900"
        >
          <GestureDetector gesture={handoffGesture}>
            <Animated.View className="flex-1 px-4 pt-4">
              <HomeHeader lastTracked={lastTracked} />

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

              <Animated.View className="flex-1 mt-4">
                <HistoryListHeader moodCount={moods.length} />
                <GestureDetector gesture={entriesNativeGesture}>
                  <FlashList
                    data={moods}
                    keyExtractor={keyExtractor}
                    renderItem={renderMoodItem}
                    ListEmptyComponent={listEmptyComponent}
                    refreshControl={
                      <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refreshMoods}
                        tintColor={isDark ? "#A8C5A8" : "#5B8A5B"}
                        colors={[isDark ? "#A8C5A8" : "#5B8A5B"]}
                        progressBackgroundColor={isDark ? "#2C4038" : "#FDFCFA"}
                      />
                    }
                    contentInsetAdjustmentBehavior="automatic"
                    showsVerticalScrollIndicator
                    contentContainerStyle={listContentContainerStyle}
                    onScroll={handleListScroll}
                    scrollEventThrottle={16}
                  />
                </GestureDetector>
              </Animated.View>
            </Animated.View>
          </GestureDetector>
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

interface CollapsedMoodSelectorProps {
  isDark: boolean;
  onMoodPress: (mood: number) => void;
  onLongPress: (mood: number) => void;
}

const PILL_WIDTH = 52;
const PILL_HEIGHT = 38;
const PILL_GAP = 5;
const TRACK_PADDING_X = 8;
const CENTER_INDEX = 5; // mood 5 — the midpoint of the 0–10 scale

function CollapsedMoodSelector({
  isDark,
  onMoodPress,
  onLongPress,
}: CollapsedMoodSelectorProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  const contentWidth =
    TRACK_PADDING_X * 2 +
    moodScale.length * PILL_WIDTH +
    (moodScale.length - 1) * PILL_GAP;

  // Center on mood 5 once we know the viewport width. If everything fits,
  // `flexGrow + justifyContent: center` on the contentContainer handles
  // visual centering; the scrollTo is a no-op (clamped to 0).
  useEffect(() => {
    if (trackWidth <= 0) return;
    if (contentWidth <= trackWidth) return;

    const targetCenter =
      TRACK_PADDING_X +
      CENTER_INDEX * (PILL_WIDTH + PILL_GAP) +
      PILL_WIDTH / 2;
    const maxScroll = contentWidth - trackWidth;
    const x = Math.max(0, Math.min(maxScroll, targetCenter - trackWidth / 2));

    // Defer one frame so the ScrollView has its content laid out.
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x, y: 0, animated: false });
    });
  }, [trackWidth, contentWidth]);

  const fitsWithoutScroll = contentWidth <= trackWidth;

  return (
    <View
      onLayout={(e: LayoutChangeEvent) =>
        setTrackWidth(e.nativeEvent.layout.width)
      }
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
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        // When content fits, center it; when it overflows, allow free scroll.
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
      </ScrollView>
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
