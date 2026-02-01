/**
 * Modal Store
 * Centralized state management for all modal visibility states.
 */

import { create } from "zustand";
import type { MoodEntry } from "@db/types";

export type ModalStore = {
  // Date picker modal
  showDateModal: boolean;
  selectedMoodForDate: MoodEntry | null;
  openDateModal: (mood: MoodEntry) => void;
  closeDateModal: () => void;

  // Quick entry modal
  quickEntryVisible: boolean;
  openQuickEntry: (mood: number) => void;
  closeQuickEntry: () => void;

  // Detailed entry modal
  detailedEntryVisible: boolean;
  openDetailedEntry: (mood: number) => void;
  closeDetailedEntry: () => void;

  // Edit entry modal
  editingEntry: MoodEntry | null;
  openEditEntry: (entry: MoodEntry) => void;
  closeEditEntry: () => void;

  // Pending mood value (used by both quick and detailed entry)
  pendingMood: number;
  setPendingMood: (mood: number) => void;

  // Close all modals
  closeAll: () => void;
};

export const useModalStore = create<ModalStore>((set) => ({
  // Date picker modal
  showDateModal: false,
  selectedMoodForDate: null,
  openDateModal: (mood) => set({ showDateModal: true, selectedMoodForDate: mood }),
  closeDateModal: () => set({ showDateModal: false, selectedMoodForDate: null }),

  // Quick entry modal
  quickEntryVisible: false,
  openQuickEntry: (mood) => set({ quickEntryVisible: true, pendingMood: mood }),
  closeQuickEntry: () => set({ quickEntryVisible: false }),

  // Detailed entry modal
  detailedEntryVisible: false,
  openDetailedEntry: (mood) => set({ detailedEntryVisible: true, pendingMood: mood }),
  closeDetailedEntry: () => set({ detailedEntryVisible: false }),

  // Edit entry modal
  editingEntry: null,
  openEditEntry: (entry) => set({ editingEntry: entry }),
  closeEditEntry: () => set({ editingEntry: null }),

  // Pending mood
  pendingMood: 5,
  setPendingMood: (mood) => set({ pendingMood: mood }),

  // Close all
  closeAll: () =>
    set({
      showDateModal: false,
      selectedMoodForDate: null,
      quickEntryVisible: false,
      detailedEntryVisible: false,
      editingEntry: null,
    }),
}));

export default useModalStore;
