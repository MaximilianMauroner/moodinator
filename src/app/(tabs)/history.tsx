import React, { useCallback, useRef, useState } from "react";
import { RefreshControl, ScrollView as RNScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import type { MoodEntry } from "@db/types";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createScreenErrorFallback } from "@/components/ScreenErrorFallback";
import { DateTimePickerModal } from "@/components/DateTimePickerModal";
import { DisplayMoodItem } from "@/components/DisplayMoodItem";
import { EditMoodEntryModal, type MoodEntryFormValues } from "@/components/MoodEntryModal";
import { DayDetailModal, MoodCalendar } from "@/components/calendar";
import { HistoryListHeader } from "@/components/home";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SettingsGearButton } from "@/components/ui/SettingsGearButton";
import { TabSceneTransition } from "@/components/ui/TabSceneTransition";
import { getThemedColor, useThemeColors } from "@/constants/colors";
import { typography } from "@/constants/typography";
import { ActiveFilterChips } from "@/features/history/ActiveFilterChips";
import { ForecastCard } from "@/features/history/ForecastCard";
import { HistoryFilterSheet } from "@/features/history/HistoryFilterSheet";
import { useHistoryForecast } from "@/features/history/useHistoryForecast";
import { useEntrySettings } from "@/hooks/useEntrySettings";
import { useMoodItemActions } from "@/hooks/useMoodItemActions";
import { useMoodModals } from "@/hooks/useMoodModals";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { updateMoodEntryOrThrow, updateMoodTimestampOrThrow } from "@/lib/moodEntryPersistence";
import { useMoodsStore } from "@/shared/state/moodsStore";

const HistoryErrorFallback = createScreenErrorFallback("History");
const FORECAST_DAYS = 7;

type HistoryView = "days" | "month";
const VIEWS: { id: HistoryView; label: string; icon: "partly-sunny-outline" | "calendar-outline" }[] = [
  { id: "days", label: "Days", icon: "partly-sunny-outline" },
  { id: "month", label: "Month", icon: "calendar-outline" },
];

function HistoryScreenContent() {
  const { get, isDark } = useThemeColors();
  const [view, setView] = useState<HistoryView>("days");

  const moods = useMoodsStore((state) => state.moods);
  const total = useMoodsStore((state) => state.total);
  const isStale = useMoodsStore((state) => state.isStale);
  const filters = useMoodsStore((state) => state.filters);
  const clearFilters = useMoodsStore((state) => state.clearFilters);
  const status = useMoodsStore((state) => state.status);
  const error = useMoodsStore((state) => state.error);
  const loadAll = useMoodsStore((state) => state.loadAll);
  const loadMore = useMoodsStore((state) => state.loadMore);
  const loadingMore = useMoodsStore((state) => state.loadingMore);
  const ensureFresh = useMoodsStore((state) => state.ensureFresh);
  const refreshMoods = useMoodsStore((state) => state.refreshMoods);
  const updateMood = useMoodsStore((state) => state.update);
  const updateMoodTimestamp = useMoodsStore((state) => state.updateTimestamp);

  const { recent, days: forecastDays, selectedDay, selectDay, closeDay } = useHistoryForecast(FORECAST_DAYS);

  const entrySettings = useEntrySettings();
  const modals = useMoodModals();
  const itemActions = useMoodItemActions({ setEditingEntry: modals.setEditingEntry });

  useFocusEffect(
    useCallback(() => {
      void ensureFresh();
    }, [ensureFresh])
  );

  const calendarRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const handleCalendarRefreshReady = useCallback((refresh: (() => Promise<void>) | null) => {
    calendarRefreshRef.current = refresh;
  }, []);

  const refreshHistory = useCallback(async () => {
    recent.reload();
    await Promise.all([refreshMoods(), calendarRefreshRef.current?.()]);
  }, [recent, refreshMoods]);
  const { refreshing, onRefresh } = usePullToRefresh(refreshHistory);

  const handleEditEntrySave = useCallback(
    async (values: MoodEntryFormValues) => {
      if (!modals.editingEntry) return;
      await updateMoodEntryOrThrow(updateMood, modals.editingEntry.id, values);
    },
    [modals.editingEntry, updateMood]
  );

  const handleDateTimeSave = useCallback(
    async (moodId: number, newTimestamp: number, utcOffsetMinutes?: number | null) => {
      await updateMoodTimestampOrThrow(updateMoodTimestamp, moodId, newTimestamp, utcOffsetMinutes);
    },
    [updateMoodTimestamp]
  );

  const renderItem = useCallback(
    ({ item }: { item: MoodEntry }) => (
      <DisplayMoodItem
        mood={item}
        onSwipeableWillOpen={itemActions.onSwipeableWillOpen}
        onPress={modals.openDateModal}
        onLongPress={modals.openDateModal}
        onEdit={modals.setEditingEntry}
        onDelete={itemActions.handleDeleteMood}
        swipeThreshold={itemActions.SWIPE_THRESHOLD}
      />
    ),
    [itemActions, modals]
  );

  const header = (
    <View style={{ gap: 14, paddingBottom: 12 }}>
      <View className="flex-row items-center justify-between pt-4">
        <View>
          <Text style={[typography.titleMd, { color: get("text"), fontSize: 24, lineHeight: 28 }]}>History</Text>
          <Text style={[typography.bodySm, { color: get("textSubtle"), marginTop: 2 }]}>
            {view === "days" ? "Lightest to heaviest, each day" : "Each day shows its average weather"}
          </Text>
        </View>
        <SettingsGearButton />
      </View>
      <SegmentedControl value={view} items={VIEWS} onChange={setView} variant="primary" padding={4} />
      {view === "days" ? (
        <>
          {recent.error ? (
            <EmptyState icon="warning-outline" tone="coral" title="The last 7 days could not load" description={recent.error} actionLabel="Try Again" onAction={recent.reload} />
          ) : (
            <ForecastCard days={forecastDays} ready={recent.loaded} onSelectDay={selectDay} />
          )}
          <View>
            <View className="mb-3 flex-row items-center justify-between gap-2">
              <View className="flex-1">
                <HistoryListHeader title="All entries" moodCount={total} countSuffix={isStale ? "pending refresh" : "total"} countTestID="history-count" />
              </View>
              <HistoryFilterSheet />
            </View>
            <ActiveFilterChips />
          </View>
        </>
      ) : (
        <MoodCalendar onEditEntry={modals.setEditingEntry} onRefreshReady={handleCalendarRefreshReady} />
      )}
    </View>
  );

  const emptyList =
    view === "month" ? null : status === "loading" ? (
      <LoadingSpinner message="Loading..." />
    ) : status === "error" ? (
      <EmptyState
        icon="warning-outline"
        tone="coral"
        title="Mood history could not load"
        description={error ?? "Your local mood history is still on this device. Try loading it again."}
        actionLabel="Try Again"
        onAction={() => { void loadAll(); }}
      />
    ) : Object.keys(filters).length ? (
      <EmptyState icon="search-outline" tone="sage" title="No matching entries" description="Try changing or clearing your filters." actionLabel="Clear filters" onAction={() => { void clearFilters(); }} />
    ) : (
      <EmptyState icon="partly-sunny-outline" tone="sage" title="No entries yet" description="Tap the weather you feel on the Today tab to start." />
    );

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
          <FlashList
            renderScrollComponent={RNScrollView}
            data={view === "days" ? moods : []}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            ListHeaderComponent={header}
            ListEmptyComponent={emptyList}
            onEndReached={() => { if (view === "days") void loadMore(); }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              view !== "days" ? null : loadingMore ? (
                <LoadingSpinner message="Loading more..." />
              ) : error && moods.length > 0 ? (
                <EmptyState icon="warning-outline" tone="coral" title="History could not load" description={error} actionLabel="Try again" onAction={() => { void refreshMoods(); }} />
              ) : null
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={getThemedColor("primary", isDark)}
                colors={[getThemedColor("primary", isDark)]}
                progressBackgroundColor={getThemedColor("surface", isDark)}
              />
            }
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            showsVerticalScrollIndicator
          />
        </SafeAreaView>
      </GestureHandlerRootView>

      {selectedDay ? (
        <DayDetailModal
          visible
          date={selectedDay.date}
          entries={selectedDay.entries}
          onClose={closeDay}
          onEditEntry={(entry) => {
            closeDay();
            modals.setEditingEntry(entry);
          }}
        />
      ) : null}
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

export default function HistoryScreen() {
  return (
    <ErrorBoundary FallbackComponent={HistoryErrorFallback}>
      <TabSceneTransition>
        <HistoryScreenContent />
      </TabSceneTransition>
    </ErrorBoundary>
  );
}
