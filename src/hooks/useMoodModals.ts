import { useState, useCallback, useMemo } from "react";
import type { MoodEntry } from "@db/types";

/**
 * Hook for managing modal visibility and related state.
 * Handles quick entry, detailed entry, editing, and date picker modals.
 */
export function useMoodModals() {
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedMood, setSelectedMood] = useState<MoodEntry | null>(null);
  const [quickEntryVisible, setQuickEntryVisible] = useState(false);
  const [detailedEntryVisible, setDetailedEntryVisible] = useState(false);
  const [pendingMood, setPendingMood] = useState(5);
  const [editingEntry, setEditingEntry] = useState<MoodEntry | null>(null);

  const handleMoodPress = useCallback((mood: number) => {
    setPendingMood(mood);
    setQuickEntryVisible(true);
  }, []);

  const handleLongPress = useCallback((mood: number) => {
    setPendingMood(mood);
    setDetailedEntryVisible(true);
  }, []);

  const closeQuickEntry = useCallback(() => {
    setQuickEntryVisible(false);
  }, []);

  const closeDetailedEntry = useCallback(() => {
    setDetailedEntryVisible(false);
  }, []);

  const closeEditEntry = useCallback(() => {
    setEditingEntry(null);
  }, []);

  const openDateModal = useCallback((mood: MoodEntry) => {
    setSelectedMood(mood);
    setShowDateModal(true);
  }, []);

  const closeDateModal = useCallback(() => {
    setShowDateModal(false);
  }, []);

  const editingInitialValues = useMemo(
    () =>
      editingEntry
        ? {
            mood: editingEntry.mood,
            emotions: editingEntry.emotions,
            contextTags: editingEntry.contextTags,
            energy: editingEntry.energy,
            note: editingEntry.note ?? "",
          }
        : undefined,
    [editingEntry]
  );

  return {
    // Date modal
    showDateModal,
    selectedMood,
    openDateModal,
    closeDateModal,

    // Quick entry
    quickEntryVisible,
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
    handleMoodPress,
    handleLongPress,
  };
}

export default useMoodModals;
