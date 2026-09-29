import { useState, useCallback, useMemo } from "react";
import type { MoodEntry } from "@db/types";
import type { MoodEntryFormValues } from "@/components/entry/moodEntryDraft";

function toInitialValues(entry: MoodEntry | null): Partial<MoodEntryFormValues> | undefined {
  return entry
    ? {
        mood: entry.mood,
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
 * Handles the detail sheet for a kept entry, detailed entry, editing, and the
 * date picker.
 *
 * Mood selectors own their press feedback, so opening a modal does not add a
 * second haptic for the same gesture.
 */
export function useMoodModals() {
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedMood, setSelectedMood] = useState<MoodEntry | null>(null);
  const [detailedEntryVisible, setDetailedEntryVisible] = useState(false);
  const [pendingMood, setPendingMood] = useState(5);
  const [editingEntry, setEditingEntry] = useState<MoodEntry | null>(null);
  const [keptEntry, setKeptEntry] = useState<MoodEntry | null>(null);

  const handleLongPress = useCallback((mood: number) => {
    setPendingMood(mood);
    setDetailedEntryVisible(true);
  }, []);

  const closeDetailedEntry = useCallback(() => {
    setDetailedEntryVisible(false);
  }, []);

  const closeEditEntry = useCallback(() => {
    setEditingEntry(null);
  }, []);

  const closeKeptEntry = useCallback(() => {
    setKeptEntry(null);
  }, []);

  const openDateModal = useCallback((mood: MoodEntry) => {
    setSelectedMood(mood);
    setShowDateModal(true);
  }, []);

  const closeDateModal = useCallback(() => {
    setShowDateModal(false);
  }, []);

  const editingInitialValues = useMemo(() => toInitialValues(editingEntry), [editingEntry]);
  const keptInitialValues = useMemo(() => toInitialValues(keptEntry), [keptEntry]);

  return {
    // Date modal
    showDateModal,
    selectedMood,
    openDateModal,
    closeDateModal,

    // Detail for an entry that one tap kept
    keptEntry,
    setKeptEntry,
    closeKeptEntry,
    keptInitialValues,

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
