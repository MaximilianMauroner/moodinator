export type DeleteLocalDataLoadingState = "delete" | null;

export type DeleteLocalDataAlertButton = {
  text: string;
  style?: "cancel" | "destructive";
  onPress?: () => void | Promise<void>;
};

export type DeleteLocalDataConfirmationOptions = {
  showAlert: (
    title: string,
    message?: string,
    buttons?: DeleteLocalDataAlertButton[]
  ) => void;
  deleteLocalMoodData: () => Promise<void>;
  loadBackupInfo: () => Promise<void>;
  setLoading: (loading: DeleteLocalDataLoadingState) => void;
  onError?: (error: unknown) => void;
};

export function confirmDeleteLocalMoodData({
  showAlert,
  deleteLocalMoodData,
  loadBackupInfo,
  setLoading,
  onError = console.error,
}: DeleteLocalDataConfirmationOptions): void {
  showAlert(
    "Delete Local Mood Data?",
    "This permanently deletes your mood entries stored on this device. Separate exports or backup files you already saved are not deleted.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete Data",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading("delete");
            await deleteLocalMoodData();
            await loadBackupInfo();
            showAlert("Data Deleted", "Your local mood entries have been deleted.");
          } catch (error) {
            showAlert("Delete Error", "Failed to delete local mood data.");
            onError(error);
          } finally {
            setLoading(null);
          }
        },
      },
    ]
  );
}
