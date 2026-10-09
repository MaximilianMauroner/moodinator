import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { exportMoods } from "./db";
import {
  BACKUP_INTERVAL_MS,
  WEEKS_TO_KEEP,
  getBackupFilename,
  parseBackupFilename,
  parseBackupUri,
  selectBackupsForDeletion,
  sortBackupsNewestFirst,
  type BackupFileSummary,
} from "./backupPolicy";

export type BackupResult<T> =
  | { success: true; data: T; warning?: string }
  | { success: false; error: string };

const LAST_BACKUP_KEY = "lastBackupTimestamp";
const BACKUP_FOLDER_KEY = "backupFolderUri"; // User-selected backup folder URI

// Default backup directory (fallback if user hasn't selected one).
// Use documentDirectory so automatic backups are durable and survive OS cache eviction.
// iOS file sharing / open-in-place is disabled in app config, which reduces user-browsable exposure.
const DEFAULT_BACKUP_DIR = `${FileSystem.documentDirectory}MoodinatorBackups/`;

// Legacy location introduced previously on iOS. Keep a migration path so existing backups remain visible.
const LEGACY_IOS_CACHE_BACKUP_DIR =
  Platform.OS === "ios" && FileSystem.cacheDirectory
    ? `${FileSystem.cacheDirectory}MoodinatorBackups/`
    : null;

async function migrateLegacyIosCacheBackupsIfNeeded(targetDir: string): Promise<void> {
  if (
    Platform.OS !== "ios" ||
    !LEGACY_IOS_CACHE_BACKUP_DIR ||
    targetDir !== DEFAULT_BACKUP_DIR ||
    LEGACY_IOS_CACHE_BACKUP_DIR === DEFAULT_BACKUP_DIR
  ) {
    return;
  }

  try {
    const legacyDirInfo = await FileSystem.getInfoAsync(LEGACY_IOS_CACHE_BACKUP_DIR);
    if (!legacyDirInfo.exists) {
      return;
    }

    const files = await FileSystem.readDirectoryAsync(LEGACY_IOS_CACHE_BACKUP_DIR);
    let migratedCount = 0;

    for (const file of files) {
      if (!file.startsWith("moodinator-backup-") || !file.endsWith(".json")) {
        continue;
      }

      const from = `${LEGACY_IOS_CACHE_BACKUP_DIR}${file}`;
      const to = `${DEFAULT_BACKUP_DIR}${file}`;
      const targetInfo = await FileSystem.getInfoAsync(to);

      if (targetInfo.exists) {
        continue;
      }

      try {
        await FileSystem.moveAsync({ from, to });
        migratedCount++;
      } catch (moveError) {
        try {
          await FileSystem.copyAsync({ from, to });
          migratedCount++;
        } catch (copyError) {
          console.warn(`Failed to migrate legacy backup ${file}:`, copyError);
        }
      }
    }

    if (migratedCount > 0) {
      console.log(`Migrated ${migratedCount} legacy iOS backup(s) from cache to documents`);
    }
  } catch (error) {
    console.warn("Error migrating legacy iOS cache backups:", error);
  }
}

/** Gets the selected destination, or the private default when none is selected. */
function getBackupDirectory(folderUri: string | null): string {
  if (!folderUri) {
    return DEFAULT_BACKUP_DIR;
  }
  return folderUri.endsWith("/") ? folderUri : `${folderUri}/`;
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
  return AsyncStorage.getItem(BACKUP_FOLDER_KEY);
}

/** Checks the requested destination without changing it on failure. */
async function ensureBackupDirectory(backupDir: string): Promise<void> {
  if (backupDir.startsWith("content://")) {
    await FileSystem.StorageAccessFramework.readDirectoryAsync(backupDir);
    return;
  }

  const dirInfo = await FileSystem.getInfoAsync(backupDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(backupDir, { intermediates: true });
  }
  await migrateLegacyIosCacheBackupsIfNeeded(backupDir);
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
 * Creates a new backup of all mood data
 * Saves to user-selected backup folder (or default if not selected)
 */
export async function createBackup(): Promise<BackupResult<string>> {
  try {
    const folderUri = await getBackupFolder();
    if (Platform.OS === "android" && !folderUri) {
      return {
        success: false,
        error: "Select a backup folder in Settings > Data & Backups, then run the backup again.",
      };
    }

    const backupDir = getBackupDirectory(folderUri);
    try {
      await ensureBackupDirectory(backupDir);
    } catch (error) {
      console.error("Error accessing backup directory:", error);
      return {
        success: false,
        error: folderUri
          ? "Moodinator cannot access the selected backup folder. Select the folder again in Settings > Data & Backups, then retry."
          : "Moodinator cannot access backup storage. Check available device storage, restart the app, then retry.",
      };
    }

    const timestamp = Date.now();
    const filename = getBackupFilename(timestamp);
    const jsonData = await exportMoods();
    const fileUri = backupDir.startsWith("content://")
      ? await FileSystem.StorageAccessFramework.createFileAsync(
          backupDir,
          filename,
          "application/json"
        )
      : `${backupDir}${filename}`;

    await FileSystem.writeAsStringAsync(fileUri, jsonData, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await setLastBackupTimestamp(timestamp);
    console.log(`Backup created: ${filename} at ${fileUri}`);

    try {
      const deletedCount = await cleanupOldBackups(fileUri);
      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} old backup(s)`);
      }
    } catch (error) {
      console.error("Backup saved, but retention cleanup failed:", error);
      return {
        success: true,
        data: fileUri,
        warning: "Backup saved, but older backups could not be removed. Check folder access and available storage, then run the backup again.",
      };
    }
    return { success: true, data: fileUri };
  } catch (error) {
    console.error("Error creating backup:", error);
    return {
      success: false,
      error: Platform.OS === "android"
        ? "Moodinator could not save the backup. Check available device storage and try again. Select the backup folder again in Settings > Data & Backups if access has changed."
        : "Moodinator could not save the backup. Check available device storage, restart the app, then try again.",
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

/** Lists supported physical backup files in one managed location. */
async function readBackupDirectory(backupDir: string): Promise<BackupFileSummary[]> {
  if (backupDir.startsWith("content://")) {
    const uris = await FileSystem.StorageAccessFramework.readDirectoryAsync(backupDir);
    return uris.flatMap((uri) => {
      const file = parseBackupUri(uri);
      return file ? [file] : [];
    });
  }

  const dirInfo = await FileSystem.getInfoAsync(backupDir);
  if (!dirInfo.exists) {
    return [];
  }
  const names = await FileSystem.readDirectoryAsync(backupDir);
  return names.flatMap((name) => {
    const file = parseBackupFilename(name, `${backupDir}${name}`);
    return file ? [file] : [];
  });
}

/** Counts each physical URI, including same-day copies and private legacy files. */
async function getBackupFiles(): Promise<BackupFileSummary[]> {
  const backupDir = getBackupDirectory(await getBackupFolder());
  await migrateLegacyIosCacheBackupsIfNeeded(backupDir);
  const directories = backupDir === DEFAULT_BACKUP_DIR
    ? [backupDir]
    : [backupDir, DEFAULT_BACKUP_DIR];
  const backupFiles: BackupFileSummary[] = [];
  const seenUris = new Set<string>();

  for (const directory of directories) {
    const files = await readBackupDirectory(directory);
    for (const file of files) {
      if (!seenUris.has(file.uri)) {
        backupFiles.push(file);
        seenUris.add(file.uri);
      }
    }
  }
  return sortBackupsNewestFirst(backupFiles);
}

/** Keeps the eight newest dated physical backups, including the file just saved. */
export async function cleanupOldBackups(createdBackupUri?: string): Promise<number> {
  const backupFiles = await getBackupFiles();
  const filesToDelete = selectBackupsForDeletion(backupFiles, WEEKS_TO_KEEP, createdBackupUri);

  for (const file of filesToDelete) {
    if (file.uri.startsWith("content://")) {
      await FileSystem.StorageAccessFramework.deleteAsync(file.uri);
    } else {
      await FileSystem.deleteAsync(file.uri, { idempotent: true });
    }
    console.log(`Deleted old backup: ${file.filename}`);
  }
  return filesToDelete.length;
}

/**
 * Gets the timestamp of the last backup (exported for background task)
 */
export async function getLastBackupTime(): Promise<number | null> {
  return getLastBackupTimestamp();
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
  const backupFiles = await getBackupFiles();
  const backupDir = getBackupDirectory(await getBackupFolder());
  let totalSize = 0;
  const files = [];

  for (const file of backupFiles) {
    let size = 0;
    try {
      const fileInfo = await FileSystem.getInfoAsync(file.uri);
      size = fileInfo.exists && "size" in fileInfo ? fileInfo.size : 0;
    } catch {
      // Some SAF providers can list files but cannot return their size.
    }
    totalSize += size;
    files.push({ filename: file.filename, timestamp: file.timestamp, size });
  }

  return {
    count: backupFiles.length,
    latestBackup: backupFiles[0]?.timestamp ?? null,
    totalSize,
    files,
    backupDirectory: backupDir,
  };
}
