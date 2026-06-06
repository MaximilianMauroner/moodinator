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

export type ExportRange = "week" | "month" | "custom" | "full";
export type ExportRangePayload =
  | { preset: "week" | "month" }
  | { startDate: number; endDate: number }
  | undefined;

export type BackupInfoSummary = {
  count: number;
  latestBackup: number | null;
};

export type BackupStatusSummary = {
  info: BackupInfoSummary;
  folderUri: string | null;
};

export type ManualBackupOutcome =
  | { success: true; title: "Backup Created"; message: string }
  | { success: false; title: "Backup Failed" | "Backup Error"; message: string };

export type ExportRequest = {
  range: ExportRange;
  customStartDate: Date;
  customEndDate: Date;
  now?: Date;
};

export type ExportRequestResolution =
  | { ok: true; payload: ExportRangePayload; fileName: string }
  | { ok: false; title: string; message: string };

export type CreateExportOutcome =
  | { ok: true; payload: ExportRangePayload; fileName: string; jsonData: string }
  | { ok: false; title: string; message: string };

function formatDateSlug(date: Date) {
  return date.toISOString().split("T")[0];
}

function resolveExportRangePayload(
  range: ExportRange,
  customStartDate: Date,
  customEndDate: Date
): ExportRangePayload | null {
  if (range === "full") {
    return undefined;
  }
  if (range === "week" || range === "month") {
    return { preset: range };
  }

  const start = new Date(customStartDate);
  const end = new Date(customEndDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (end.getTime() < start.getTime()) {
    return null;
  }

  return { startDate: start.getTime(), endDate: end.getTime() };
}

function buildExportFileName(request: ExportRequest): string {
  const now = request.now ?? new Date();

  if (request.range === "custom") {
    return `moodinator-export-${formatDateSlug(request.customStartDate)}-to-${formatDateSlug(request.customEndDate)}.json`;
  }

  if (request.range === "full") {
    return `moodinator-export-full-${formatDateSlug(now)}.json`;
  }

  return `moodinator-export-${request.range}-${formatDateSlug(now)}.json`;
}

export const dataPortabilityService = {
  resolveExportRequest(request: ExportRequest): ExportRequestResolution {
    const payload = resolveExportRangePayload(
      request.range,
      request.customStartDate,
      request.customEndDate
    );

    if (payload === null) {
      return {
        ok: false,
        title: "Invalid Range",
        message: "End date must be after the start date.",
      };
    }

    return {
      ok: true,
      payload,
      fileName: buildExportFileName(request),
    };
  },

  async exportData(range?: MoodDateRange): Promise<string> {
    return exportMoods(range);
  },

  async createExport(
    request: ExportRequest
  ): Promise<CreateExportOutcome> {
    const resolved = this.resolveExportRequest(request);
    if (!resolved.ok) {
      return resolved;
    }

    return {
      ...resolved,
      jsonData: await exportMoods(resolved.payload),
    };
  },

  async importData(jsonData: string): Promise<ImportResult> {
    const result = await importMoods(jsonData);
    useMoodsStore.getState().invalidate();
    void useMoodsStore.getState().ensureFresh();
    return result;
  },

  summarizeImportResult(importResult: ImportResult): string {
    return [
      `Imported ${importResult.imported} entr${importResult.imported === 1 ? "y" : "ies"}.`,
      importResult.skipped > 0
        ? `Skipped ${importResult.skipped} invalid entr${importResult.skipped === 1 ? "y" : "ies"}.`
        : null,
      importResult.errors.length > 0
        ? importResult.errors.slice(0, 2).join("\n")
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");
  },

  async createBackup(): Promise<BackupResult<string>> {
    return createBackup();
  },

  async runBackupNow(): Promise<ManualBackupOutcome> {
    try {
      const backupResult = await createBackup();
      if (backupResult.success) {
        return {
          success: true,
          title: "Backup Created",
          message: "Backup created successfully.",
        };
      }

      return {
        success: false,
        title: "Backup Failed",
        message: backupResult.error,
      };
    } catch {
      return {
        success: false,
        title: "Backup Error",
        message: "Failed to create backup.",
      };
    }
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

  async getBackupStatus(): Promise<BackupStatusSummary> {
    const [info, folderUri] = await Promise.all([
      this.getBackupInfo(),
      this.getBackupFolder(),
    ]);

    return { info, folderUri };
  },

  async setBackupFolder(uri: string): Promise<void> {
    await setBackupFolder(uri);
  },
};

export default dataPortabilityService;
