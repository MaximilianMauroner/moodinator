import {
  createBackup,
  getBackupFolder,
  getBackupInfo,
  setBackupFolder,
  type BackupResult,
} from "@db/backup";
import { exportMoods, importMoods, type ImportResult } from "@db/db";
import type { MoodDateRange } from "@db/moods/range";
import { useMoodsStore } from "@/shared/state/moodsStore";

export type BackupInfoSummary = {
  count: number;
  latestBackup: number | null;
};

export const dataPortabilityService = {
  async exportData(range?: MoodDateRange): Promise<string> {
    return exportMoods(range);
  },

  async importData(jsonData: string): Promise<ImportResult> {
    const result = await importMoods(jsonData);
    useMoodsStore.getState().invalidate();
    void useMoodsStore.getState().ensureFresh();
    return result;
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
