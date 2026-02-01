import React, { useCallback } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { DisplayMoodItem } from "@/components/DisplayMoodItem";
import { useColorScheme } from "@/hooks/useColorScheme";
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
