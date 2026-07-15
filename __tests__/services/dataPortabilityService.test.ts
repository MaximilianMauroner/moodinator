import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exportMoods: vi.fn(),
  importMoods: vi.fn(),
  previewImportMoods: vi.fn(),
  clearMoodData: vi.fn(),
  createBackup: vi.fn(),
  getBackupInfo: vi.fn(),
  getBackupFolder: vi.fn(),
  setBackupFolder: vi.fn(),
  addMissingFromHistory: vi.fn(),
  invalidate: vi.fn(),
  ensureFresh: vi.fn(),
}));

vi.mock("@db/db", () => ({
  exportMoods: mocks.exportMoods,
  importMoods: mocks.importMoods,
  previewImportMoods: mocks.previewImportMoods,
  clearMoodData: mocks.clearMoodData,
}));

vi.mock("@/services/presetSyncService", () => ({
  presetSyncService: {
    addMissingFromHistory: mocks.addMissingFromHistory,
  },
}));

vi.mock("@db/backup", () => ({
  createBackup: mocks.createBackup,
  getBackupInfo: mocks.getBackupInfo,
  getBackupFolder: mocks.getBackupFolder,
  setBackupFolder: mocks.setBackupFolder,
}));

vi.mock("@/shared/state/moodsStore", () => ({
  useMoodsStore: {
    getState: () => ({
      invalidate: mocks.invalidate,
      ensureFresh: mocks.ensureFresh,
    }),
  },
}));

import { dataPortabilityService } from "../../src/services/dataPortabilityService";

describe("dataPortabilityService", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("resolves export ranges and file names", async () => {
    mocks.exportMoods.mockResolvedValue("[{\"mood\":4}]");

    const result = await dataPortabilityService.createExport({
      range: "week",
      customStartDate: new Date("2026-05-01T12:00:00Z"),
      customEndDate: new Date("2026-05-07T12:00:00Z"),
      now: new Date("2026-05-27T12:00:00Z"),
    });

    expect(result).toMatchObject({
      ok: true,
      fileName: "moodinator-export-week-2026-05-27.json",
      jsonData: "[{\"mood\":4}]",
    });
    expect(mocks.exportMoods).toHaveBeenCalledWith({ preset: "week" });
  });

  it("rejects invalid custom export ranges before exporting", async () => {
    const result = await dataPortabilityService.createExport({
      range: "custom",
      customStartDate: new Date("2026-05-08T12:00:00Z"),
      customEndDate: new Date("2026-05-07T12:00:00Z"),
    });

    expect(result).toEqual({
      ok: false,
      title: "Invalid Range",
      message: "End date must be after the start date.",
    });
    expect(mocks.exportMoods).not.toHaveBeenCalled();
  });

  it("summarizes import outcomes for the UI", () => {
    expect(
      dataPortabilityService.summarizeImportResult({
        imported: 2,
        skipped: 1,
        errors: ["Entry 3 invalid", "Entry 4 invalid", "Entry 5 invalid"],
      })
    ).toBe(
      "Imported 2 entries.\n\nSkipped 1 invalid entry.\n\nEntry 3 invalid\nEntry 4 invalid"
    );
  });

  it("summarizes imported preset additions for the UI", () => {
    expect(
      dataPortabilityService.summarizeImportResult({
        imported: 2,
        skipped: 0,
        errors: [],
        addedEmotions: [{ name: "Calm", category: "positive" }],
        addedContexts: ["Work", "Doctor"],
      })
    ).toBe(
      "Imported 2 entries.\n\nAdded 1 emotion to your Emotion List.\n\nAdded 2 context tags to your Context Tag List."
    );
  });

  it("syncs presets and invalidates mood history after importing data", async () => {
    mocks.importMoods.mockResolvedValue({ imported: 1, skipped: 0, errors: [] });
    mocks.addMissingFromHistory.mockResolvedValue({
      addedEmotions: [{ name: "Calm", category: "positive" }],
      addedContexts: ["Work"],
    });

    await expect(dataPortabilityService.importData("[]")).resolves.toEqual({
      imported: 1,
      skipped: 0,
      errors: [],
      addedEmotions: [{ name: "Calm", category: "positive" }],
      addedContexts: ["Work"],
    });
    expect(mocks.addMissingFromHistory).toHaveBeenCalledWith("all");
    expect(mocks.invalidate).toHaveBeenCalledTimes(1);
    expect(mocks.ensureFresh).toHaveBeenCalledTimes(1);
  });

  it("previews imports for the destructive replacement prompt", () => {
    mocks.previewImportMoods.mockReturnValue({ entryCount: 3 });

    const preview = dataPortabilityService.previewImportData("[{\"mood\":3}]");

    expect(preview).toEqual({ entryCount: 3 });
    expect(mocks.previewImportMoods).toHaveBeenCalledWith("[{\"mood\":3}]");
    expect(dataPortabilityService.summarizeImportPreview(preview)).toBe(
      "The selected file contains 3 entries. Importing replaces your current local Moodinator data."
    );
  });

  it("deletes local mood data and refreshes mood history", async () => {
    mocks.clearMoodData.mockResolvedValue(undefined);
    mocks.ensureFresh.mockResolvedValue(undefined);

    await dataPortabilityService.deleteLocalMoodData();

    expect(mocks.clearMoodData).toHaveBeenCalledTimes(1);
    expect(mocks.invalidate).toHaveBeenCalledTimes(1);
    expect(mocks.ensureFresh).toHaveBeenCalledTimes(1);
  });

  it("returns manual backup outcomes", async () => {
    mocks.createBackup.mockResolvedValueOnce({ success: true });
    await expect(dataPortabilityService.runBackupNow()).resolves.toEqual({
      success: true,
      title: "Backup Created",
      message: "Backup created successfully.",
    });

    mocks.createBackup.mockResolvedValueOnce({ success: false, error: "disk full" });
    await expect(dataPortabilityService.runBackupNow()).resolves.toEqual({
      success: false,
      title: "Backup Failed",
      message: "disk full",
    });
  });

  it("loads backup metadata and folder together", async () => {
    mocks.getBackupInfo.mockResolvedValue({ count: 2, latestBackup: 123 });
    mocks.getBackupFolder.mockResolvedValue("file:///backups");

    await expect(dataPortabilityService.getBackupStatus()).resolves.toEqual({
      info: { count: 2, latestBackup: 123 },
      folderUri: "file:///backups",
    });
  });
});
