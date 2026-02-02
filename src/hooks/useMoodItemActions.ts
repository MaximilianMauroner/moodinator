import { useCallback } from "react";
import { deleteMood, insertMoodEntry } from "@db/db";
import { Toast } from "toastify-react-native";
import type { MoodEntry } from "@db/types";
import type { SwipeDirection } from "@/types/mood";
import { haptics } from "@/lib/haptics";

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
      await deleteMood(mood.id);
      setMoods((prev) => prev.filter((m) => m.id !== mood.id));
      Toast.show({
        type: "success",
        text1: "Entry removed",
        text2: "Tap Undo to restore",
        autoHide: true,
        visibilityTime: 3000,
        progressBarColor: "#A78BFA",
        onPress: async () => {
          if (mood) {
            haptics.success(); // Haptic feedback for undo/restore
            const crmood = await insertMoodEntry({
              mood: mood.mood,
              note: mood.note,
              timestamp: new Date(mood.timestamp).getTime(),
              emotions: mood.emotions,
              contextTags: mood.contextTags,
              energy: mood.energy,
            });

            setMoods((prev) => {
              const updated = [...prev, crmood].sort(
                (a, b) =>
                  new Date(b.timestamp).getTime() -
                  new Date(a.timestamp).getTime()
              );
              return updated;
            });

            setLastTracked((prevLastTracked) => {
              if (
                !prevLastTracked ||
                new Date(crmood.timestamp) > prevLastTracked
              ) {
                return new Date(crmood.timestamp);
              }
              return prevLastTracked;
            });
            Toast.hide();
          } else {
            Toast.error("Failed to restore mood");
          }
        },
      });
    },
    [setMoods, setLastTracked]
  );

  const onSwipeableWillOpen = useCallback(
    (direction: SwipeDirection, mood: MoodEntry) => {
      if (direction === "left") {
        handleDeleteMood(mood);
      } else if (direction === "right") {
        setEditingEntry(mood);
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
