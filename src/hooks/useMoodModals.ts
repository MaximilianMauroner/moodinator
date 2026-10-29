import { useState, useCallback, useMemo } from "react";
import type { MoodEntry } from "@db/types";
import type { MoodEntryFormValues } from "@/components/entry/moodEntryDraft";
import { getInterpretedMoodRating } from "@/constants/moodScaleInterpretation";

function toInitialValues(entry: MoodEntry | null): Partial<MoodEntryFormValues> | undefined {
  return entry
    ? {
        mood: getInterpretedMoodRating(entry),
        emotions: entry.emotions,
        contextTags: entry.contextTags,
        energy: entry.energy,
        note: entry.note ?? "",
        basedOnEntryId: entry.basedOnEntryId,
      }
    : undefined;
}

/**
 * Hook for managing modal visibility and related state.
 * Handles the quick detail sheet, detailed entry, editing, and the date
 * picker. Competing opens notify the caller before changing modal state; the
 * quick-tap continuation and closing a modal retain their current flow.
 *
 * Mood selectors own their press feedback, so opening a modal does not add a
 * second haptic for the same gesture.
 */
export function useMoodModals(onOpen?: () => void) {
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedMood, setSelectedMood] = useState<MoodEntry | null>(null);
  const [detailedEntryVisible, setDetailedEntryVisible] = useState(false);
  const [pendingMood, setPendingMood] = useState(5);
  const [editingEntry, updateEditingEntry] = useState<MoodEntry | null>(null);
  /** The tapped mood while the quick detail sheet is open; nothing is saved until Done. */
  const [quickMood, setQuickMood] = useState<number | null>(null);

  const handleLongPress = useCallback((mood: number) => {
    onOpen?.();
    setPendingMood(mood);
    setDetailedEntryVisible(true);
  }, [onOpen]);

  const closeDetailedEntry = useCallback(() => {
    setDetailedEntryVisible(false);
  }, []);

  const closeEditEntry = useCallback(() => {
    updateEditingEntry(null);
  }, []);

  const closeQuickEntry = useCallback(() => {
    setQuickMood(null);
  }, []);

  const openDateModal = useCallback((mood: MoodEntry) => {
    onOpen?.();
    setSelectedMood(mood);
    setShowDateModal(true);
  }, [onOpen]);

  const setEditingEntry = useCallback((entry: MoodEntry) => {
    onOpen?.();
    updateEditingEntry(entry);
  }, [onOpen]);

  const closeDateModal = useCallback(() => {
    setShowDateModal(false);
  }, []);

  const editingInitialValues = useMemo(() => toInitialValues(editingEntry), [editingEntry]);

  return {
    // Date modal
    showDateModal,
    selectedMood,
    openDateModal,
    closeDateModal,

    // Quick detail for a tapped mood
    quickMood,
    setQuickMood,
    closeQuickEntry,

    // Detailed entry
    detailedEntryVisible,
    closeDetailedEntry,

    // Editing
    editingEntry,
    setEditingEntry,
    closeEditEntry,
    editingInitialValues,

    // Mood selection
    pendingMood,
    handleLongPress,
  };
}

export default useMoodModals;
