import type { MoodEntry } from "@db/types";

import { DeletedMoodToast } from "@/components/ui/DeletedMoodToast";
import { toast } from "@/lib/toast";

type ToastId = string | number;
type UndoDeletedMoodHandler = (entry: MoodEntry) => Promise<void> | void;

const deletedMoodEntries = new Map<ToastId, MoodEntry>();

function cleanupDeletedMoodEntry(toastId: ToastId) {
  deletedMoodEntries.delete(toastId);
}

async function restoreDeletedMood(
  toastId: ToastId,
  onUndo: UndoDeletedMoodHandler
) {
  const deletedEntry = deletedMoodEntries.get(toastId);

  if (!deletedEntry) {
    toast.error("Undo expired", {
      description: "That deleted entry is no longer available to restore.",
    });
    return;
  }

  try {
    await onUndo(deletedEntry);
    cleanupDeletedMoodEntry(toastId);
    toast.dismiss(toastId);
    toast.success("Entry restored", {
      description: "The deleted mood entry is back in your history.",
      duration: 2600,
    });
  } catch (error) {
    console.error("[toastService] Failed to restore deleted entry:", error);
    toast.error("Restore failed", {
      description: "The deleted entry could not be restored.",
    });
  }
}

export const toastService = {
  success(title: string, description?: string, toastId?: ToastId) {
    return toast.success(title, {
      id: toastId,
      description,
    });
  },

  error(title: string, description?: string, toastId?: ToastId) {
    return toast.error(title, {
      id: toastId,
      description,
    });
  },

  dismiss(toastId?: ToastId) {
    return toast.dismiss(toastId);
  },

  showDeletedMood(entry: MoodEntry, onUndo: UndoDeletedMoodHandler) {
    const toastId = `deleted-mood-${entry.id}-${entry.timestamp}-${Date.now()}`;
    deletedMoodEntries.set(toastId, entry);

    return toast.custom(
      () => (
        <DeletedMoodToast
          entry={entry}
          onUndo={() => {
            void restoreDeletedMood(toastId, onUndo);
          }}
        />
      ),
      {
        id: toastId,
        duration: 5000,
        onDismiss: () => cleanupDeletedMoodEntry(toastId),
        onAutoClose: () => cleanupDeletedMoodEntry(toastId),
      }
    );
  },
};

export default toastService;
