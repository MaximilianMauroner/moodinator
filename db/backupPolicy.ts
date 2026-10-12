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
  const match = filename.match(
    /^moodinator-backup-(\d{4}-\d{2}-\d{2})(?: \([1-9]\d*\))?\.json$/
  );
  if (!match) {
    return null;
  }

  const dateStr = match[1];
  const timestamp = Date.parse(`${dateStr}T00:00:00.000Z`);

  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== dateStr) {
    return null;
  }

  return { uri, timestamp, filename };
}

export function parseBackupUri(uri: string): BackupFileSummary | null {
  let decodedUri: string;
  try {
    decodedUri = decodeURIComponent(uri);
  } catch {
    return null;
  }

  // SAF document IDs include a volume prefix and can contain an encoded path.
  const filename = decodedUri.split("/").pop()?.split(":").pop();
  if (!filename) {
    return null;
  }
  return parseBackupFilename(filename, uri);
}

export function sortBackupsNewestFirst<T extends BackupFileSummary>(files: T[]): T[] {
  return [...files].sort((a, b) => b.timestamp - a.timestamp);
}

export function selectBackupsForDeletion<T extends BackupFileSummary>(
  files: T[],
  keepCount = WEEKS_TO_KEEP,
  createdBackupUri?: string
): T[] {
  // A just-written file must survive its own cleanup, even when dated files tie.
  const createdBackup = files.find((file) => file.uri === createdBackupUri);
  const candidates = files.filter((file) => file.uri !== createdBackupUri);
  return sortBackupsNewestFirst(candidates).slice(keepCount - (createdBackup ? 1 : 0));
}
