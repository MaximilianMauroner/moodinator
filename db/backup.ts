import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { exportMoods } from "./db";

export type BackupResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const LAST_BACKUP_KEY = "lastBackupTimestamp";
const BACKUP_SCHEDULED_ID_KEY = "backupScheduledId";
const BACKUP_FOLDER_KEY = "backupFolderUri"; // User-selected backup folder URI
const WEEKS_TO_KEEP = 8; // Keep backups for 8 weeks (rolling)
const BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const BACKUP_DAY_OF_WEEK = 0; // Sunday (0 = Sunday, 1 = Monday, etc.)
const BACKUP_HOUR = 7; // 7 AM (early morning, less intrusive)
const BACKUP_MINUTE = 0;

// Default backup directory (fallback if user hasn't selected one)
const DEFAULT_BACKUP_DIR = `${FileSystem.documentDirectory}MoodinatorBackups/`;

/**
 * Gets the user-selected backup folder URI, or returns default
 */
async function getBackupDirectory(): Promise<string> {
  try {
    const folderUri = await AsyncStorage.getItem(BACKUP_FOLDER_KEY);
    if (folderUri) {
      return folderUri.endsWith("/") ? folderUri : `${folderUri}/`;
    }
  } catch (error) {
    console.error("Error getting backup folder:", error);
  }
  return DEFAULT_BACKUP_DIR;
}

/**
 * Sets the user-selected backup folder URI
 */
export async function setBackupFolder(folderUri: string): Promise<void> {
  try {
    // Ensure URI ends with /
    const normalizedUri = folderUri.endsWith("/") ? folderUri : `${folderUri}/`;
    await AsyncStorage.setItem(BACKUP_FOLDER_KEY, normalizedUri);
    console.log("Backup folder set to:", normalizedUri);
  } catch (error) {
    console.error("Error setting backup folder:", error);
    throw error;
  }
}

/**
 * Gets the current backup folder URI
 */
export async function getBackupFolder(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(BACKUP_FOLDER_KEY);
  } catch (error) {
    console.error("Error getting backup folder:", error);
    return null;
  }
}

/**
 * Ensures the backup directory exists
 */
async function ensureBackupDirectory(): Promise<string> {
  const backupDir = await getBackupDirectory();
  try {
    // Handle Android SAF URIs
    if (backupDir.startsWith("content://")) {
      // With SAF, we assume the user selected a valid directory
      // We don't need to "create" it, but we can check read access by listing files
      // This also verifies permissions are still granted
      try {
        await FileSystem.StorageAccessFramework.readDirectoryAsync(backupDir);
        return backupDir;
      } catch (e) {
        console.warn(
          "Selected SAF directory not accessible (permissions revoked?):",
          e
        );
        throw e;
      }
    }

    // Handle standard FileSystem paths
    const dirInfo = await FileSystem.getInfoAsync(backupDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(backupDir, { intermediates: true });
    }
  } catch (error) {
    console.error("Error ensuring backup directory exists:", error);
    // If user-selected folder fails, try default
    if (backupDir !== DEFAULT_BACKUP_DIR) {
      console.warn("User-selected folder inaccessible, using default");
      const defaultDirInfo = await FileSystem.getInfoAsync(DEFAULT_BACKUP_DIR);
      if (!defaultDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DEFAULT_BACKUP_DIR, {
          intermediates: true,
        });
      }
      return DEFAULT_BACKUP_DIR;
    }
    throw error;
  }
  return backupDir;
}

/**
 * Gets the timestamp of the last backup
 */
async function getLastBackupTimestamp(): Promise<number | null> {
  try {
    const timestamp = await AsyncStorage.getItem(LAST_BACKUP_KEY);
    return timestamp ? parseInt(timestamp, 10) : null;
  } catch (error) {
    console.error("Error getting last backup timestamp:", error);
    return null;
  }
}

/**
 * Sets the timestamp of the last backup
 */
async function setLastBackupTimestamp(timestamp: number): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_BACKUP_KEY, timestamp.toString());
  } catch (error) {
    console.error("Error setting last backup timestamp:", error);
  }
}

/**
 * Creates a backup filename with timestamp
 */
function getBackupFilename(timestamp: number): string {
  const date = new Date(timestamp);
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
  return `moodinator-backup-${dateStr}.json`;
}

/**
 * Creates a new backup of all mood data
 * Saves to user-selected backup folder (or default if not selected)
 */
export async function createBackup(): Promise<BackupResult<string>> {
  try {
    // On Android, enforce user-selected folder
    if (Platform.OS === "android") {
      const userFolder = await getBackupFolder();
      if (!userFolder) {
        return {
          success: false,
          error: "No backup folder selected. Please select a backup location in Settings.",
        };
      }
    }

    let backupDir: string;
    try {
      backupDir = await ensureBackupDirectory();
    } catch (e) {
      return {
        success: false,
        error: "Could not access backup folder. Please check permissions or select a new location.",
      };
    }

    const timestamp = Date.now();
    const filename = getBackupFilename(timestamp);

    // Export all mood data
    const jsonData = await exportMoods();

    let fileUri: string;

    // Handle Android SAF URIs
    if (backupDir.startsWith("content://")) {
      try {
        // Create file using SAF
        fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          backupDir,
          filename,
          "application/json"
        );

        // Write content
        await FileSystem.writeAsStringAsync(fileUri, jsonData, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } catch (e) {
        console.error("Error writing to SAF directory:", e);
        // Fallback to default directory
        try {
          const defaultDirInfo = await FileSystem.getInfoAsync(DEFAULT_BACKUP_DIR);
          if (!defaultDirInfo.exists) {
            await FileSystem.makeDirectoryAsync(DEFAULT_BACKUP_DIR, { intermediates: true });
          }
          const defaultUri = `${DEFAULT_BACKUP_DIR}${filename}`;
          await FileSystem.writeAsStringAsync(defaultUri, jsonData, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          fileUri = defaultUri;
          console.warn("Fell back to default directory due to SAF error");
        } catch (fallbackError) {
          return {
            success: false,
            error: "Could not write backup file. Storage may be full or permissions denied.",
          };
        }
      }
    } else {
      // Standard FileSystem path
      fileUri = `${backupDir}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, jsonData, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    }

    // Update last backup timestamp
    await setLastBackupTimestamp(timestamp);

    console.log(`Backup created: ${filename} at ${fileUri}`);
    // Clean up old backups after creating a new one
    const deletedCount = await cleanupOldBackups();
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} old backup(s)`);
    }
    return { success: true, data: fileUri };
  } catch (error) {
    console.error("Error creating backup:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred while creating backup.",
    };
  }
}

/**
 * Checks if a backup is needed (if it's been more than a week since last backup)
 */
export async function isBackupNeeded(): Promise<boolean> {
  try {
    const lastBackup = await getLastBackupTimestamp();

    if (!lastBackup) {
      // No backup exists, create one
      return true;
    }

    const now = Date.now();
    const timeSinceLastBackup = now - lastBackup;

    // If it's been more than the backup interval, create a new backup
    return timeSinceLastBackup >= BACKUP_INTERVAL_MS;
  } catch (error) {
    console.error("Error checking if backup is needed:", error);
    return false;
  }
}

/**
 * Gets all backup files sorted by date (newest first)
 * Checks both user-selected folder and default folder
 */
async function getBackupFiles(): Promise<
  Array<{ uri: string; timestamp: number; filename: string }>
> {
  try {
    const backupDir = await getBackupDirectory();
    const backupFiles: Array<{
      uri: string;
      timestamp: number;
      filename: string;
    }> = [];
    const seenFilenames = new Set<string>();

    // Check user-selected folder
    try {
      if (backupDir.startsWith("content://")) {
        // Handle Android SAF URIs
        const files =
          await FileSystem.StorageAccessFramework.readDirectoryAsync(backupDir);
        for (const fileUri of files) {
          // Decode URI to get filename (rough approximation, SAF URIs are complex)
          // For SAF, we rely on reading the file content or metadata if needed,
          // but for listing, we just check if it looks like a backup file
          // SAF file URIs don't easily map to filenames, so we might need to just list them
          // For now, we'll try to extract a name or read metadata

          // Note: SAF readDirectoryAsync returns an array of URIs
          // We can't easily filter by name without reading info for each file
          // which is slow. So we'll just list all files and check if we can parse date

          // Simplification: On Android SAF, we might not easily filter by filename pattern
          // without checking each file. For performance, we might skip this or do it lazily.
          // For this implementation, we'll skip SAF listing optimization and just try to read info

          // Optimization: just return the URI, handle details later
          // Or, we can try to parse the URI if it contains the name
          const uriDecoded = decodeURIComponent(fileUri);
          if (uriDecoded.includes("moodinator-backup-")) {
            // Try to extract timestamp
            const match = uriDecoded.match(
              /moodinator-backup-(\d{4}-\d{2}-\d{2})/
            );
            if (match) {
              const dateStr = match[1];
              const timestamp = new Date(dateStr).getTime();
              if (!isNaN(timestamp)) {
                backupFiles.push({
                  uri: fileUri,
                  timestamp,
                  filename: `moodinator-backup-${dateStr}.json`, // Reconstruct name
                });
                seenFilenames.add(`moodinator-backup-${dateStr}.json`);
              }
            }
          }
        }
      } else {
        // Standard FileSystem path
        const dirInfo = await FileSystem.getInfoAsync(backupDir);
        if (dirInfo.exists) {
          const files = await FileSystem.readDirectoryAsync(backupDir);
          for (const file of files) {
            if (
              file.startsWith("moodinator-backup-") &&
              file.endsWith(".json") &&
              !seenFilenames.has(file)
            ) {
              const dateStr = file
                .replace("moodinator-backup-", "")
                .replace(".json", "");
              const timestamp = new Date(dateStr).getTime();
              if (!isNaN(timestamp)) {
                backupFiles.push({
                  uri: `${backupDir}${file}`,
                  timestamp,
                  filename: file,
                });
                seenFilenames.add(file);
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn("Error reading user-selected backup folder:", error);
    }

    // Also check default folder if different (and not SAF)
    if (backupDir !== DEFAULT_BACKUP_DIR) {
      try {
        const defaultDirInfo = await FileSystem.getInfoAsync(
          DEFAULT_BACKUP_DIR
        );
        if (defaultDirInfo.exists) {
          const files = await FileSystem.readDirectoryAsync(DEFAULT_BACKUP_DIR);
          for (const file of files) {
            if (
              file.startsWith("moodinator-backup-") &&
              file.endsWith(".json") &&
              !seenFilenames.has(file)
            ) {
              const dateStr = file
                .replace("moodinator-backup-", "")
                .replace(".json", "");
              const timestamp = new Date(dateStr).getTime();
              if (!isNaN(timestamp)) {
                backupFiles.push({
                  uri: `${DEFAULT_BACKUP_DIR}${file}`,
                  timestamp,
                  filename: file,
                });
                seenFilenames.add(file);
              }
            }
          }
        }
      } catch (error) {
        console.warn("Error reading default backup folder:", error);
      }
    }

    // Sort by timestamp (newest first)
    return backupFiles.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("Error getting backup files:", error);
    return [];
  }
}

/**
 * Cleans up old backups
 * Keeps only the most recent WEEKS_TO_KEEP backups
 * Also deletes backups older than the cutoff date
 */
export async function cleanupOldBackups(): Promise<number> {
  try {
    const backupFiles = await getBackupFiles();

    if (backupFiles.length <= WEEKS_TO_KEEP) {
      return 0;
    }

    // Identify files to delete:
    // 1. Everything after the first WEEKS_TO_KEEP (since they are sorted by date descending)
    // 2. Any file older than the cutoff date (though 1 should cover most cases)
    const filesToDelete = backupFiles.slice(WEEKS_TO_KEEP);
    let deletedCount = 0;

    for (const file of filesToDelete) {
      try {
        // Handle SAF URIs
        if (file.uri.startsWith("content://")) {
          await FileSystem.StorageAccessFramework.deleteAsync(file.uri);
        } else {
          await FileSystem.deleteAsync(file.uri, { idempotent: true });
        }
        deletedCount++;
        console.log(`Deleted old backup: ${file.filename}`);
      } catch (error) {
        console.error(`Error deleting backup ${file.filename}:`, error);
      }
    }

    return deletedCount;
  } catch (error) {
    console.error("Error cleaning up old backups:", error);
    return 0;
  }
}

/**
 * Performs automatic backup check and creation if needed
 * This is called when the scheduled backup time arrives
 */
export async function performAutomaticBackup(): Promise<BackupResult<string | null>> {
  try {
    // Check if backup is needed
    if (await isBackupNeeded()) {
      console.log("Creating automatic weekly backup...");
      const result = await createBackup();

      if (!result.success) {
        console.error("Automatic backup failed:", result.error);
        return result;
      }

      // Clean up old backups after creating a new one
      const deletedCount = await cleanupOldBackups();
      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} old backup(s)`);
      }

      // Reschedule for next week
      await rescheduleWeeklyBackup();
      return result;
    }
    return { success: true, data: null };
  } catch (error) {
    console.error("Error performing automatic backup:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Automatic backup failed unexpectedly.",
    };
  }
}

/**
 * Calculates the next Sunday at the backup time (2 AM)
 */
function getNextBackupDate(): Date {
  const now = new Date();
  const next = new Date();
  next.setHours(BACKUP_HOUR, BACKUP_MINUTE, 0, 0);

  // Calculate days until next Sunday (0 = Sunday)
  const daysUntilSunday = (7 - now.getDay() + BACKUP_DAY_OF_WEEK) % 7;

  if (daysUntilSunday === 0) {
    // Today is Sunday, check if we've passed the backup time
    if (
      now.getHours() > BACKUP_HOUR ||
      (now.getHours() === BACKUP_HOUR && now.getMinutes() >= BACKUP_MINUTE)
    ) {
      // Backup time has passed today, schedule for next Sunday
      next.setDate(now.getDate() + 7);
    } else {
      // Backup time hasn't passed today, use today
      next.setDate(now.getDate());
    }
  } else {
    // Schedule for the next Sunday
    next.setDate(now.getDate() + daysUntilSunday);
  }

  return next;
}

/**
 * Schedules a weekly backup notification/check
 * The backup will be performed when the app is active at the scheduled time
 */
export async function scheduleWeeklyBackup(): Promise<void> {
  try {
    // Cancel any existing scheduled backup
    const existingId = await AsyncStorage.getItem(BACKUP_SCHEDULED_ID_KEY);
    if (existingId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(existingId);
      } catch (e) {
        console.warn("Failed to cancel existing backup notification:", e);
      }
      await AsyncStorage.removeItem(BACKUP_SCHEDULED_ID_KEY);
    }

    // Calculate next Sunday at 2 AM
    const nextBackupDate = getNextBackupDate();

    // Schedule backup notification for next Sunday
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Weekly Backup",
        body: "Your mood data is being backed up automatically",
        data: { type: "weekly-backup" },
        sound: false, // Silent notification
      },
      trigger: {
        date: nextBackupDate,
        type: Notifications.SchedulableTriggerInputTypes.DATE,
      },
    });

    await AsyncStorage.setItem(BACKUP_SCHEDULED_ID_KEY, notificationId);
    console.log(
      `Weekly backup scheduled for ${nextBackupDate.toLocaleString()}`
    );
  } catch (error) {
    console.error("Error scheduling weekly backup:", error);
  }
}

/**
 * Reschedules the weekly backup after one has been performed
 * This ensures the backup continues to run weekly
 */
export async function rescheduleWeeklyBackup(): Promise<void> {
  await scheduleWeeklyBackup();
}

/**
 * Checks if it's time for a scheduled backup and performs it if needed
 * This should be called when the app becomes active
 */
export async function checkScheduledBackup(): Promise<void> {
  try {
    const lastBackup = await getLastBackupTimestamp();
    if (!lastBackup) {
      // No backup exists yet, create one immediately
      await performAutomaticBackup();
      return;
    }

    // Check if it's been a week since last backup
    const now = Date.now();
    const timeSinceLastBackup = now - lastBackup;

    // If it's been more than the backup interval, perform backup
    if (timeSinceLastBackup >= BACKUP_INTERVAL_MS) {
      await performAutomaticBackup();
    }
  } catch (error) {
    console.error("Error checking scheduled backup:", error);
  }
}

/**
 * Gets information about existing backups
 */
export async function getBackupInfo(): Promise<{
  count: number;
  latestBackup: number | null;
  totalSize: number;
  files: Array<{ filename: string; timestamp: number; size: number }>;
  backupDirectory: string;
}> {
  try {
    const backupFiles = await getBackupFiles();
    const backupDir = await getBackupDirectory();

    let totalSize = 0;
    const files = [];

    for (const file of backupFiles) {
      try {
        // Handle standard FileSystem paths
        if (!file.uri.startsWith("content://")) {
          const fileInfo = await FileSystem.getInfoAsync(file.uri);
          const size =
            fileInfo.exists && "size" in fileInfo ? fileInfo.size : 0;
          totalSize += size;

          files.push({
            filename: file.filename,
            timestamp: file.timestamp,
            size,
          });
        } else {
          // For SAF URIs, we might skip getting exact size if it's too slow
          // or try to get it via FileSystem.getInfoAsync which *might* work on file URIs
          // even if it doesn't work on tree URIs
          try {
            const fileInfo = await FileSystem.getInfoAsync(file.uri);
            const size =
              fileInfo.exists && "size" in fileInfo ? fileInfo.size : 0;
            totalSize += size;

            files.push({
              filename: file.filename,
              timestamp: file.timestamp,
              size,
            });
          } catch (e) {
            // If getting info fails, just add with 0 size
            files.push({
              filename: file.filename,
              timestamp: file.timestamp,
              size: 0,
            });
          }
        }
      } catch (e) {
        // Ignore errors for individual files
      }
    }

    return {
      count: backupFiles.length,
      latestBackup: backupFiles.length > 0 ? backupFiles[0].timestamp : null,
      totalSize,
      files,
      backupDirectory: backupDir,
    };
  } catch (error) {
    console.error("Error getting backup info:", error);
    return {
      count: 0,
      latestBackup: null,
      totalSize: 0,
      files: [],
      backupDirectory: DEFAULT_BACKUP_DIR,
    };
  }
}
