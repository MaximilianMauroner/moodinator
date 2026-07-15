export type BackupFileSummary = {
  uri: string;
  timestamp: number;
  filename: string;
};

export const WEEKS_TO_KEEP = 8;
export const BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function getBackupFilename(timestamp: number): string {
  const date = new Date(timestamp);
  const dateStr = date.toISOString().split("T")[0];
  return `moodinator-backup-${dateStr}.json`;
}

export function parseBackupFilename(
  filename: string,
  uri: string
): BackupFileSummary | null {
  if (!filename.startsWith("moodinator-backup-") || !filename.endsWith(".json")) {
    return null;
  }

  const dateStr = filename
    .replace("moodinator-backup-", "")
    .replace(".json", "");
  const timestamp = new Date(dateStr).getTime();

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return { uri, timestamp, filename };
}

export function parseBackupUri(uri: string): BackupFileSummary | null {
  const uriDecoded = decodeURIComponent(uri);
  const match = uriDecoded.match(/moodinator-backup-(\d{4}-\d{2}-\d{2})/);
  if (!match) {
    return null;
  }

  const filename = `moodinator-backup-${match[1]}.json`;
  return parseBackupFilename(filename, uri);
}

export function sortBackupsNewestFirst<T extends BackupFileSummary>(files: T[]): T[] {
  return [...files].sort((a, b) => b.timestamp - a.timestamp);
}

export function selectBackupsForDeletion<T extends BackupFileSummary>(
  files: T[],
  keepCount = WEEKS_TO_KEEP
): T[] {
  return sortBackupsNewestFirst(files).slice(keepCount);
}
