import * as BackgroundTask from "expo-background-task";
import Constants from "expo-constants";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { createBackup, isBackupNeeded } from "./backup";

export const BACKGROUND_BACKUP_TASK = "MOODINATOR_WEEKLY_BACKUP";

/**
 * Worker body for the periodic backup task. Exported for direct testing —
 * the TaskManager.defineTask registration below just delegates here.
 */
export async function runBackgroundBackupTask(): Promise<BackgroundTask.BackgroundTaskResult> {
  try {
    console.log("[BackgroundBackup] Task started");

    if (!(await isBackupNeeded())) {
      console.log("[BackgroundBackup] Backup not needed yet");
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    console.log("[BackgroundBackup] Creating backup...");
    // createBackup() runs cleanupOldBackups() internally on success, so no
    // extra cleanup call here.
    const result = await createBackup();

    if (!result.success) {
      console.error("[BackgroundBackup] Backup failed:", result.error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    console.log("[BackgroundBackup] Backup completed successfully");
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error("[BackgroundBackup] Task error:", error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
}

TaskManager.defineTask(BACKGROUND_BACKUP_TASK, runBackgroundBackupTask);

/**
 * Registers the periodic background backup task. The OS decides when it
 * actually fires — minimumInterval is a hint, not a guarantee. The task itself
 * throttles via isBackupNeeded so backups happen at most weekly.
 * Call this once when the app initializes.
 */
export async function registerBackgroundBackupTask(): Promise<void> {
  try {
    if (Platform.OS === "ios" && !Constants.isDevice) {
      console.log("[BackgroundBackup] Skipping background task registration on iOS simulator");
      return;
    }

    // Check if the task is already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_BACKUP_TASK);

    if (isRegistered) {
      console.log("[BackgroundBackup] Task already registered");
      return;
    }

    // Register the background task
    // minimumInterval is in MINUTES. Set to 24 hours (1440 minutes).
    // The actual interval depends on OS scheduling. The task will check if a week has passed.
    // Note: iOS minimum is 15 minutes, but system often runs tasks during specific windows (e.g., overnight)
    await BackgroundTask.registerTaskAsync(BACKGROUND_BACKUP_TASK, {
      minimumInterval: 60 * 24, // 24 hours in minutes (OS may call less frequently)
    });

    console.log("[BackgroundBackup] Task registered successfully");
  } catch (error) {
    console.error("[BackgroundBackup] Failed to register task:", error);
  }
}

/**
 * Unregisters the background backup task.
 */
export async function unregisterBackgroundBackupTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_BACKUP_TASK);

    if (!isRegistered) {
      console.log("[BackgroundBackup] Task not registered");
      return;
    }

    await BackgroundTask.unregisterTaskAsync(BACKGROUND_BACKUP_TASK);
    console.log("[BackgroundBackup] Task unregistered");
  } catch (error) {
    console.error("[BackgroundBackup] Failed to unregister task:", error);
  }
}

/**
 * Gets the current status of the background task.
 */
export async function getBackgroundBackupStatus(): Promise<{
  isRegistered: boolean;
  status: BackgroundTask.BackgroundTaskStatus | null;
  statusDescription: string;
}> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_BACKUP_TASK);
    const status = await BackgroundTask.getStatusAsync();

    let statusDescription: string;
    switch (status) {
      case BackgroundTask.BackgroundTaskStatus.Restricted:
        statusDescription = "Background task is restricted (battery saver or other system restriction)";
        break;
      case BackgroundTask.BackgroundTaskStatus.Available:
        statusDescription = "Background task is available";
        break;
      case null:
        statusDescription = "Background task status unavailable";
        break;
      default:
        statusDescription = "Unknown status";
    }

    return { isRegistered, status, statusDescription };
  } catch (error) {
    console.error("[BackgroundBackup] Failed to get status:", error);
    return {
      isRegistered: false,
      status: null,
      statusDescription: "Error checking background task status",
    };
  }
}
