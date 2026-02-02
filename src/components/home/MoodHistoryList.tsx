import React, { useCallback } from "react";
import { FlatList, RefreshControl } from "react-native";
import { DisplayMoodItem } from "@/components/DisplayMoodItem";
import { useColorScheme } from "@/hooks/useColorScheme";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import type { MoodEntry } from "@db/types";
import type { SwipeDirection } from "@/types/mood";

interface MoodHistoryListProps {
  moods: MoodEntry[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onSwipeableWillOpen: (direction: SwipeDirection, mood: MoodEntry) => void;
  onMoodItemLongPress: (mood: MoodEntry) => void;
  swipeThreshold: number;
}

/**
 * FlatList component for displaying mood history entries.
 * Includes pull-to-refresh and empty state handling.
 */
export function MoodHistoryList({
  moods,
  loading,
  refreshing,
  onRefresh,
  onSwipeableWillOpen,
  onMoodItemLongPress,
  swipeThreshold,
}: MoodHistoryListProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const renderMoodItem = useCallback(
    ({ item }: { item: MoodEntry }) => (
      <DisplayMoodItem
        mood={item}
        onSwipeableWillOpen={onSwipeableWillOpen}
        onLongPress={onMoodItemLongPress}
        swipeThreshold={swipeThreshold}
      />
    ),
    [onSwipeableWillOpen, onMoodItemLongPress, swipeThreshold]
  );

  const renderEmptyComponent = useCallback(() => {
    if (loading) {
      return <LoadingSpinner message="Loading..." />;
    }

    return (
      <EmptyState
        emoji="🌿"
        title="Start your journey"
        description="Tap a mood above to log how you're feeling right now"
      />
    );
  }, [loading]);

  return (
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
  );
}

export default MoodHistoryList;
