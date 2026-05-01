import { useCallback } from "react";
import type { MoodEntry } from "@db/types";
import type { SwipeDirection } from "@/types/mood";
import { haptics } from "@/lib/haptics";
import { moodService } from "@/services/moodService";
import { toastService } from "@/services/toastService";

type MoodsSetter =
  | React.Dispatch<React.SetStateAction<MoodEntry[]>>
  | ((updater: MoodEntry[] | ((prev: MoodEntry[]) => MoodEntry[])) => void);

interface UseMoodItemActionsParams {
  setMoods: MoodsSetter;
  setLastTracked: React.Dispatch<React.SetStateAction<Date | null>> | (() => void);
  setEditingEntry: (entry: MoodEntry) => void;
}

/**
 * Hook for handling mood item actions (delete, swipe, long press).
 */
export function useMoodItemActions({
  setMoods,
  setLastTracked,
  setEditingEntry,
}: UseMoodItemActionsParams) {
  const SWIPE_THRESHOLD = 100;

  const handleDeleteMood = useCallback(
    async (mood: MoodEntry) => {
      haptics.warning(); // Haptic feedback for delete action
      await moodService.delete(mood.id);
      setMoods((prev) => prev.filter((m) => m.id !== mood.id));
      toastService.showDeletedMood(mood, async (deletedMood) => {
        haptics.success(); // Haptic feedback for undo/restore
        const restoredMood = await moodService.create({
          mood: deletedMood.mood,
          note: deletedMood.note,
          timestamp: deletedMood.timestamp,
          emotions: deletedMood.emotions,
          contextTags: deletedMood.contextTags,
          energy: deletedMood.energy,
          basedOnEntryId: deletedMood.basedOnEntryId,
        });

        setMoods((prev) => {
          const updated = [...prev, restoredMood].sort(
            (a, b) =>
              new Date(b.timestamp).getTime() -
              new Date(a.timestamp).getTime()
          );
          return updated;
        });

        setLastTracked((prevLastTracked) => {
          if (
            !prevLastTracked ||
            new Date(restoredMood.timestamp) > prevLastTracked
          ) {
            return new Date(restoredMood.timestamp);
          }
          return prevLastTracked;
        });
      });
    },
    [setMoods, setLastTracked]
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
