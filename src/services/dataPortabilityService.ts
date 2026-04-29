import {
  createBackup,
  getBackupFolder,
  getBackupInfo,
  setBackupFolder,
  type BackupResult,
} from "@db/backup";
import { importMoods, type ImportResult } from "@db/db";

export type BackupInfoSummary = {
  count: number;
  latestBackup: number | null;
};

export const dataPortabilityService = {
  async importData(jsonData: string): Promise<ImportResult> {
    return importMoods(jsonData);
  },

  async createBackup(): Promise<BackupResult<string>> {
    return createBackup();
  },

  async getBackupInfo(): Promise<BackupInfoSummary> {
    const info = await getBackupInfo();
    return {
      count: info.count,
      latestBackup: info.latestBackup,
    };
  },

  async getBackupFolder(): Promise<string | null> {
    return getBackupFolder();
  },

  async setBackupFolder(uri: string): Promise<void> {
    await setBackupFolder(uri);
  },
};

export default dataPortabilityService;
