import { useCallback } from "react";
import type { MoodEntry } from "@db/types";
import type { SwipeDirection } from "@/types/mood";
import { haptics } from "@/lib/haptics";
import { toastService } from "@/services/toastService";
import { useMoodsStore } from "@/shared/state/moodsStore";

interface UseMoodItemActionsParams {
  setEditingEntry: (entry: MoodEntry) => void;
}

/**
 * Hook for handling mood item actions (delete, swipe, long press).
 */
export function useMoodItemActions({
  setEditingEntry,
}: UseMoodItemActionsParams) {
  const SWIPE_THRESHOLD = 100;
  const removeMood = useMoodsStore((state) => state.remove);
  const restoreMood = useMoodsStore((state) => state.restore);

  const handleDeleteMood = useCallback(
    async (mood: MoodEntry) => {
      haptics.warning(); // Haptic feedback for delete action
      await removeMood(mood.id);
      toastService.showDeletedMood(mood, async (deletedMood) => {
        haptics.success(); // Haptic feedback for undo/restore
        await restoreMood({
          mood: deletedMood.mood,
          note: deletedMood.note,
          timestamp: deletedMood.timestamp,
          emotions: deletedMood.emotions,
          contextTags: deletedMood.contextTags,
          energy: deletedMood.energy,
          moodScale: deletedMood.moodScale,
          basedOnEntryId: deletedMood.basedOnEntryId,
        });
      });
    },
    [removeMood, restoreMood]
  );

  const onSwipeableWillOpen = useCallback(
    (direction: SwipeDirection, mood: MoodEntry) => {
      if (direction === "left") {
        setEditingEntry(mood);
      } else if (direction === "right") {
        handleDeleteMood(mood);
      }
    },
    [handleDeleteMood, setEditingEntry]
  );

  const handleMoodItemLongPress = useCallback(
    (mood: MoodEntry, openDateModal: (mood: MoodEntry) => void) => {
      openDateModal(mood);
    },
    []
  );

  return {
    SWIPE_THRESHOLD,
    handleDeleteMood,
    onSwipeableWillOpen,
    handleMoodItemLongPress,
  };
}

export default useMoodItemActions;
