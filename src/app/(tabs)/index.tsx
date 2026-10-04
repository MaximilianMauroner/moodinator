import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Alert, Platform, RefreshControl, ScrollView, Text, View } from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createScreenErrorFallback } from "@/components/ScreenErrorFallback";
import { DateTimePickerModal } from "@/components/DateTimePickerModal";
import {
  DetailedMoodEntryModal,
  EditMoodEntryModal,
  KeptEntryDetailModal,
  MoodEntryFormValues,
} from "@/components/MoodEntryModal";
import { WeatherMoodGrid } from "@/components/entry/WeatherMoodGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenBackgroundAccent } from "@/components/layout/ScreenBackgroundAccent";
import { TabSceneTransition } from "@/components/ui/TabSceneTransition";
import { DetailedMoodButtonSelector, EarlierToday, HomeHeader, TodayNow } from "@/components/home";
import { getThemedColor, useThemeColors } from "@/constants/colors";
import { typography } from "@/constants/typography";

import { useRecentMoodEntries } from "@/features/history/useRecentMoodEntries";
import { buildForecastDays } from "@/features/history/forecast";
import { useMoodsStore } from "@/shared/state/moodsStore";
import { useEntrySettings } from "@/hooks/useEntrySettings";
import { useMoodModals } from "@/hooks/useMoodModals";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { haptics } from "@/lib/haptics";
import { beginMoodEntryFlow, keepMoodTap } from "@/lib/keepMoodTap";
import { showCrisisSupportAlert } from "@/lib/showCrisisSupportAlert";
import { toastService } from "@/services/toastService";
import { addHomeTabDoublePressListener } from "@/lib/homeTabEvents";
import {
  commitThenRunPostCommitEffects,
  getMoodEntryPersistenceValues,
  updateMoodEntryOrThrow,
  updateMoodTimestampOrThrow,
} from "@/lib/moodEntryPersistence";

const HomeErrorFallback = createScreenErrorFallback("Home");
const CONTENT_HORIZONTAL_PADDING = 16;

/**
 * Today: where you are now and a short view of the day on top, and the
 * weather picker docked above the tabs, within thumb reach. The full list
 * of entries lives in History.
 */
function HomeScreenContent() {
  const { isDark, get } = useThemeColors();
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();

  const refreshMoods = useMoodsStore((state) => state.refreshMoods);
  const createMood = useMoodsStore((state) => state.create);
  const updateMood = useMoodsStore((state) => state.update);
  const removeMood = useMoodsStore((state) => state.remove);
  const updateMoodTimestamp = useMoodsStore((state) => state.updateTimestamp);

  const today = useRecentMoodEntries(1);
  // Newest first.
  const todayEntries = useMemo(
    () => buildForecastDays(today.entries, today.asOf, 1)[0]!.entries.slice().reverse(),
    [today.entries, today.asOf]
  );
  const [latest, ...earlier] = todayEntries;

  const scrollRef = useRef<ScrollView>(null);
  const refreshToday = useCallback(async () => {
    today.reload();
    await refreshMoods();
  }, [refreshMoods, today]);
  const { refreshing, onRefresh: handlePullToRefresh } = usePullToRefresh(refreshToday);

  const entrySettings = useEntrySettings();
  const tapStateRef = useRef({ inFlight: false, generation: 0 });
  const invalidateEntryFlow = useCallback(() => {
    beginMoodEntryFlow(tapStateRef.current);
  }, []);
  const modals = useMoodModals(invalidateEntryFlow);
  useFocusEffect(useCallback(() => invalidateEntryFlow, [invalidateEntryFlow]));

  const handleEditEntrySave = useCallback(
    async (values: MoodEntryFormValues) => {
      if (!modals.editingEntry) return;
      await updateMoodEntryOrThrow(updateMood, modals.editingEntry.id, values);
    },
    [modals.editingEntry, updateMood]
  );

  const handleKeptEntrySave = useCallback(
    async (values: MoodEntryFormValues) => {
      if (!modals.keptEntry) return;
      await updateMoodEntryOrThrow(updateMood, modals.keptEntry.id, values);
    },
    [modals.keptEntry, updateMood]
  );

  const handleKeptEntryUndo = useCallback(() => {
    const entry = modals.keptEntry;
    modals.closeKeptEntry();
    if (!entry) return;
    void removeMood(entry.id).catch((error: unknown) => {
      console.error("Failed to undo kept entry:", error);
      toastService.error("Undo failed", "The entry could not be removed.");
    });
  }, [modals, removeMood]);

  const handleDateTimeSave = useCallback(
    async (moodId: number, newTimestamp: number, utcOffsetMinutes?: number | null) => {
      await updateMoodTimestampOrThrow(updateMoodTimestamp, moodId, newTimestamp, utcOffsetMinutes);
    },
    [updateMoodTimestamp]
  );

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const handleEntrySave = useCallback(async (values: MoodEntryFormValues) => {
    beginMoodEntryFlow(tapStateRef.current);
    await commitThenRunPostCommitEffects(
      () => createMood(getMoodEntryPersistenceValues(values)),
      [scrollToTop],
    );
  }, [createMood, scrollToTop]);

  const quickFields = entrySettings.quickEntryFieldConfig;
  const offersDetailAfterKeep =
    quickFields.emotions || quickFields.context || quickFields.energy || quickFields.notes;

  const handleMoodTap = useCallback(
    (mood: number) =>
      keepMoodTap(mood, {
        state: tapStateRef.current,
        create: createMood,
        afterCommit: [scrollToTop],
        offersDetail: offersDetailAfterKeep,
        openDetail: modals.setKeptEntry,
        showUndoToast: (entry) =>
          toastService.showKeptMood(entry, async () => {
            await removeMood(entry.id);
          }),
        showSupport: (onDecline) => showCrisisSupportAlert({ onDecline }),
        feedback: haptics,
        onSaveError: (error) => {
          console.error("Failed to save mood entry:", error);
          Alert.alert("Save failed", "Unable to save your entry. Please try again.");
        },
      }),
    [createMood, modals.setKeptEntry, offersDetailAfterKeep, removeMood, scrollToTop]
  );

  useEffect(
    () =>
      addHomeTabDoublePressListener(() => {
        scrollToTop();
        void handlePullToRefresh();
      }),
    [handlePullToRefresh, scrollToTop]
  );

  const showHistory = useCallback(() => router.navigate("/history"), [router]);

  // iOS draws the tab bar over the scene, so the dock pads for it there.
  const dockBottomPadding = 12 + (Platform.OS === "ios" ? tabBarHeight : 0);

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top", "left", "right"]}>
          <ScreenBackgroundAccent density="compact" />
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: CONTENT_HORIZONTAL_PADDING, paddingTop: 16, paddingBottom: 16, gap: 18 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handlePullToRefresh}
                tintColor={getThemedColor("primary", isDark)}
                colors={[getThemedColor("primary", isDark)]}
                progressBackgroundColor={getThemedColor("surface", isDark)}
              />
            }
          >
            <HomeHeader />
            {today.error && !latest ? (
              <EmptyState
                icon="warning-outline"
                tone="coral"
                title="Today's entries could not load"
                description="Your local mood history is still on this device. Try loading it again."
                actionLabel="Try Again"
                onAction={today.reload}
              />
            ) : (
              <TodayNow latest={latest} loaded={today.loaded} onOpen={modals.openDateModal} />
            )}
            <EarlierToday entries={earlier} onOpen={modals.openDateModal} onShowAll={showHistory} />
            {today.error && latest ? (
              <EmptyState
                icon="warning-outline"
                tone="coral"
                title="Today's entries could not refresh"
                description={today.error}
                actionLabel="Try again"
                onAction={today.reload}
              />
            ) : null}
          </ScrollView>

          <View
            style={{
              maxHeight: "65%",
              flexShrink: 1,
              backgroundColor: get("surface"),
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderColor: get("border"),
              paddingTop: 14,
              paddingHorizontal: 12,
              paddingBottom: dockBottomPadding,
            }}
          >
            <Text style={[typography.titleMd, { color: get("text"), fontSize: 18, lineHeight: 24, marginHorizontal: 8, marginBottom: 10 }]}>
              How is it now?
            </Text>
            <ScrollView style={{ flexGrow: 0, flexShrink: 1 }}>
              {entrySettings.showDetailedLabels ? (
                <DetailedMoodButtonSelector onMoodPress={handleMoodTap} onLongPress={modals.handleLongPress} />
              ) : (
                <WeatherMoodGrid size="dock" onPress={handleMoodTap} onLongPress={modals.handleLongPress} />
              )}
            </ScrollView>
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
      <KeptEntryDetailModal
        visible={Boolean(modals.keptEntry)}
        initialMood={modals.keptEntry?.mood ?? modals.pendingMood}
        emotionOptions={entrySettings.emotionOptions}
        contextOptions={entrySettings.contextOptions}
        fieldConfig={entrySettings.quickEntryFieldConfig}
        initialValues={modals.keptInitialValues}
        onClose={modals.closeKeptEntry}
        onSubmit={handleKeptEntrySave}
        onUndo={handleKeptEntryUndo}
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
