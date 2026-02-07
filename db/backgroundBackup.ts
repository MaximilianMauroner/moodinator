import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { createBackup, isBackupNeeded, cleanupOldBackups } from "./backup";

export const BACKGROUND_BACKUP_TASK = "MOODINATOR_WEEKLY_BACKUP";

/**
 * Registers the background backup task with TaskManager.
 * This must be called at the top level (outside of components).
 */
TaskManager.defineTask(BACKGROUND_BACKUP_TASK, async () => {
  try {
    console.log("[BackgroundBackup] Task started");

    // Check if backup is actually needed
    if (!(await isBackupNeeded())) {
      console.log("[BackgroundBackup] Backup not needed yet");
      return BackgroundTask.BackgroundTaskResult.Success; // Task ran successfully, just no backup needed
    }

    console.log("[BackgroundBackup] Creating backup...");
    const result = await createBackup();

    if (!result.success) {
      console.error("[BackgroundBackup] Backup failed:", result.error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    // Clean up old backups
    const deletedCount = await cleanupOldBackups();
    if (deletedCount > 0) {
      console.log(`[BackgroundBackup] Cleaned up ${deletedCount} old backup(s)`);
    }

    console.log("[BackgroundBackup] Backup completed successfully");
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error("[BackgroundBackup] Task error:", error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Registers the background task for weekly backups.
 * Call this once when the app initializes.
 */
export async function registerBackgroundBackupTask(): Promise<void> {
  try {
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
