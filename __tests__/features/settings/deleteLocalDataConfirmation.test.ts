import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmDeleteLocalMoodData,
  type DeleteLocalDataAlertButton,
} from "../../../src/features/settings/utils/deleteLocalDataConfirmation";

describe("confirmDeleteLocalMoodData", () => {
  const showAlert = vi.fn();
  const deleteLocalMoodData = vi.fn();
  const loadBackupInfo = vi.fn();
  const setLoading = vi.fn();
  const onError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    deleteLocalMoodData.mockResolvedValue(undefined);
    loadBackupInfo.mockResolvedValue(undefined);
  });

  function openConfirmation() {
    confirmDeleteLocalMoodData({
      showAlert,
      deleteLocalMoodData,
      loadBackupInfo,
      setLoading,
      onError,
    });
    return showAlert.mock.calls[0][2] as DeleteLocalDataAlertButton[];
  }

  it("does not delete data when the user cancels", () => {
    const buttons = openConfirmation();

    buttons[0].onPress?.();

    expect(buttons[0]).toMatchObject({ text: "Cancel", style: "cancel" });
    expect(deleteLocalMoodData).not.toHaveBeenCalled();
    expect(loadBackupInfo).not.toHaveBeenCalled();
    expect(setLoading).not.toHaveBeenCalled();
  });

  it("deletes local mood data, refreshes backup info, and clears loading when confirmed", async () => {
    const buttons = openConfirmation();

    await buttons[1].onPress?.();

    expect(buttons[1]).toMatchObject({ text: "Delete Data", style: "destructive" });
    expect(setLoading).toHaveBeenNthCalledWith(1, "delete");
    expect(deleteLocalMoodData).toHaveBeenCalledTimes(1);
    expect(loadBackupInfo).toHaveBeenCalledTimes(1);
    expect(showAlert).toHaveBeenLastCalledWith(
      "Data Deleted",
      "Your local mood entries have been deleted."
    );
    expect(setLoading).toHaveBeenLastCalledWith(null);
  });

  it("shows an error and clears loading when deletion fails", async () => {
    const error = new Error("delete failed");
    deleteLocalMoodData.mockRejectedValue(error);
    const buttons = openConfirmation();

    await buttons[1].onPress?.();

    expect(loadBackupInfo).not.toHaveBeenCalled();
    expect(showAlert).toHaveBeenLastCalledWith(
      "Delete Error",
      "Failed to delete local mood data."
    );
    expect(onError).toHaveBeenCalledWith(error);
    expect(setLoading).toHaveBeenLastCalledWith(null);
  });
});
