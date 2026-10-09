import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  files: new Map<string, string>(),
  directories: new Set<string>(),
  settings: new Map<string, string>(),
  platform: { OS: "android" },
  getItem: vi.fn(),
  setItem: vi.fn(),
  getInfo: vi.fn(),
  makeDirectory: vi.fn(),
  readDirectory: vi.fn(),
  readSafDirectory: vi.fn(),
  createSafFile: vi.fn(),
  writeFile: vi.fn(),
  deleteFile: vi.fn(),
  deleteSafFile: vi.fn(),
  exportMoods: vi.fn(),
}));

vi.mock("react-native", () => ({ Platform: mocks.platform }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: mocks.getItem, setItem: mocks.setItem },
}));
vi.mock("../../db/db", () => ({ exportMoods: mocks.exportMoods }));
vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///documents/",
  cacheDirectory: "file:///cache/",
  EncodingType: { UTF8: "utf8" },
  getInfoAsync: mocks.getInfo,
  makeDirectoryAsync: mocks.makeDirectory,
  readDirectoryAsync: mocks.readDirectory,
  writeAsStringAsync: mocks.writeFile,
  deleteAsync: mocks.deleteFile,
  StorageAccessFramework: {
    readDirectoryAsync: mocks.readSafDirectory,
    createFileAsync: mocks.createSafFile,
    deleteAsync: mocks.deleteSafFile,
  },
}));

import { cleanupOldBackups, createBackup, getBackupFolder, getBackupInfo } from "../../db/backup";

const SELECTED_FOLDER = "content://provider/tree/primary%3ABackups";
const PRIVATE_FOLDER = "file:///documents/MoodinatorBackups/";
const JSON_DATA = '[{"timestamp":1791474509513,"utcOffsetMinutes":0,"mood":3}]';
const nativeFailure = new Error("ExponentFileSystem.writeAsStringAsync EACCES /data/user/0/private/backups");

function safUri(filename: string): string {
  return `${SELECTED_FOLDER}/document/${encodeURIComponent(`primary:Backups/${filename}`)}`;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.files.clear();
  mocks.directories.clear();
  mocks.settings.clear();
  mocks.settings.set("backupFolderUri", SELECTED_FOLDER);
  mocks.platform.OS = "android";
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});

  mocks.getItem.mockImplementation(async (key: string) => mocks.settings.get(key) ?? null);
  mocks.setItem.mockImplementation(async (key: string, value: string) => { mocks.settings.set(key, value); });
  mocks.getInfo.mockImplementation(async (uri: string) => ({
    exists: mocks.files.has(uri) || mocks.directories.has(uri),
    size: mocks.files.get(uri)?.length ?? 0,
  }));
  mocks.makeDirectory.mockImplementation(async (uri: string) => { mocks.directories.add(uri); });
  mocks.readDirectory.mockImplementation(async (uri: string) =>
    [...mocks.files.keys()].filter((file) => file.startsWith(uri)).map((file) => file.slice(uri.length))
  );
  mocks.readSafDirectory.mockImplementation(async () =>
    [...mocks.files.keys()].filter((uri) => uri.startsWith(`${SELECTED_FOLDER}/document/`))
  );
  mocks.createSafFile.mockImplementation(async (_directory: string, filename: string) => {
    let uri = safUri(filename);
    let copy = 1;
    while (mocks.files.has(uri)) {
      uri = safUri(filename.replace(".json", ` (${copy++}).json`));
    }
    mocks.files.set(uri, "");
    return uri;
  });
  mocks.writeFile.mockImplementation(async (uri: string, data: string) => { mocks.files.set(uri, data); });
  mocks.deleteFile.mockImplementation(async (uri: string) => { mocks.files.delete(uri); });
  mocks.deleteSafFile.mockImplementation(async (uri: string) => { mocks.files.delete(uri); });
  mocks.exportMoods.mockResolvedValue(JSON_DATA);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("physical backup discovery and retention", () => {
  it("counts two real same-day SAF copies independently", async () => {
    const first = await createBackup();
    const second = await createBackup();

    expect(first).toEqual({ success: true, data: safUri("moodinator-backup-2026-10-08.json") });
    expect(second).toEqual({ success: true, data: safUri("moodinator-backup-2026-10-08 (1).json") });
    expect(await getBackupInfo()).toMatchObject({ count: 2, totalSize: JSON_DATA.length * 2 });
    expect([...mocks.files.values()]).toEqual([JSON_DATA, JSON_DATA]);
  });

  it("retains eight physical backups and preserves unrelated exports and lookalikes", async () => {
    const dates = ["2026-08-06", "2026-08-13", "2026-08-20", "2026-08-27", "2026-09-03", "2026-09-10", "2026-09-17", "2026-09-24", "2026-10-01"];
    for (const date of dates) {
      mocks.files.set(safUri(`moodinator-backup-${date}.json`), JSON_DATA);
    }
    mocks.files.set(safUri("moodinator-backup-2026-10-08.json"), JSON_DATA);
    mocks.files.set(safUri("moodinator-backup-2026-10-08 (1).json"), JSON_DATA);
    const unrelated = ["moodinator-export-full-2026-08-01.json", "moodinator-backup-2026-08-01.json.bak", "moodinator-backup-2026-08-01.txt"];
    for (const name of unrelated) {
      mocks.files.set(safUri(name), "keep unchanged");
    }

    expect(await createBackup()).toEqual({ success: true, data: safUri("moodinator-backup-2026-10-08 (2).json") });

    const info = await getBackupInfo();
    expect(info.count).toBe(8);
    expect(mocks.files.size).toBe(info.count + unrelated.length);
    expect(mocks.deleteSafFile).toHaveBeenCalledTimes(4);
    for (const date of dates.slice(0, 4)) {
      expect(mocks.files.has(safUri(`moodinator-backup-${date}.json`))).toBe(false);
    }
    for (const name of unrelated) {
      expect(mocks.files.get(safUri(name))).toBe("keep unchanged");
    }
  });

  it("keeps a just-created backup when older same-day copies fill the retention limit", async () => {
    for (let index = 0; index < 9; index++) {
      const suffix = index === 0 ? "" : ` (${index})`;
      mocks.files.set(safUri(`moodinator-backup-2026-10-08${suffix}.json`), JSON_DATA);
    }

    const result = await createBackup();

    expect(result).toEqual({ success: true, data: safUri("moodinator-backup-2026-10-08 (9).json") });
    expect(mocks.files.has(safUri("moodinator-backup-2026-10-08 (9).json"))).toBe(true);
    expect(mocks.files.size).toBe(8);
  });

  it("deduplicates only identical URIs and counts private copies with the same name", async () => {
    const filename = "moodinator-backup-2026-10-08.json";
    const uri = safUri(filename);
    mocks.files.set(uri, JSON_DATA);
    mocks.files.set(`${PRIVATE_FOLDER}${filename}`, JSON_DATA);
    mocks.directories.add(PRIVATE_FOLDER);
    mocks.readSafDirectory.mockResolvedValue([uri, uri]);

    expect(await getBackupInfo()).toMatchObject({ count: 2 });
  });

  it("propagates folder discovery failures rather than reporting zero backups", async () => {
    mocks.readSafDirectory.mockRejectedValue(nativeFailure);

    await expect(getBackupInfo()).rejects.toBe(nativeFailure);
    await expect(cleanupOldBackups()).rejects.toBe(nativeFailure);
    expect(mocks.deleteSafFile).not.toHaveBeenCalled();
  });

  it("reports a saved backup with a visible warning when retention deletion fails", async () => {
    for (let day = 1; day <= 9; day++) {
      mocks.files.set(safUri(`moodinator-backup-2026-09-${String(day).padStart(2, "0")}.json`), JSON_DATA);
    }
    mocks.deleteSafFile.mockRejectedValue(nativeFailure);

    const result = await createBackup();

    expect(result).toMatchObject({ success: true, warning: expect.stringContaining("older backups could not be removed") });
    expect(mocks.files.get(safUri("moodinator-backup-2026-10-08.json"))).toBe(JSON_DATA);
    expect(mocks.settings.has("lastBackupTimestamp")).toBe(true);
    expect(console.error).toHaveBeenCalledWith("Backup saved, but retention cleanup failed:", nativeFailure);
  });
});

describe("backup destination and failure recovery", () => {
  it("requires a selected folder on Android", async () => {
    mocks.settings.delete("backupFolderUri");

    expect(await createBackup()).toMatchObject({ success: false, error: expect.stringContaining("Select a backup folder") });
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it("fails visibly after selected-folder access is revoked, then succeeds after reselection", async () => {
    mocks.readSafDirectory.mockRejectedValueOnce(nativeFailure);

    expect(await createBackup()).toMatchObject({ success: false, error: expect.stringContaining("Select the folder again") });
    expect(await getBackupFolder()).toBe(SELECTED_FOLDER);
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.makeDirectory).not.toHaveBeenCalled();
    expect(mocks.settings.has("lastBackupTimestamp")).toBe(false);

    expect(await createBackup()).toMatchObject({ success: true });
    expect([...mocks.files.keys()].every((uri) => uri.startsWith("content://"))).toBe(true);
  });

  it.each(["create", "write"])("does not fall back to private storage after a SAF %s failure", async (step) => {
    if (step === "create") {
      mocks.createSafFile.mockRejectedValueOnce(nativeFailure);
    } else {
      mocks.writeFile.mockRejectedValueOnce(nativeFailure);
    }

    const result = await createBackup();

    expect(result).toMatchObject({ success: false, error: expect.stringContaining("Check available device storage") });
    expect(JSON.stringify(result)).not.toContain("ExponentFileSystem");
    expect(JSON.stringify(result)).not.toContain("/data/user");
    expect(mocks.makeDirectory).not.toHaveBeenCalled();
    expect([...mocks.files.keys()].some((uri) => uri.startsWith(PRIVATE_FOLDER))).toBe(false);
    expect(mocks.settings.has("lastBackupTimestamp")).toBe(false);
    expect(console.error).toHaveBeenCalledWith("Error creating backup:", nativeFailure);
  });

  it("does not treat unreadable destination settings as no selection", async () => {
    mocks.getItem.mockRejectedValue(nativeFailure);

    await expect(getBackupFolder()).rejects.toBe(nativeFailure);
    expect(await createBackup()).toMatchObject({ success: false });
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.makeDirectory).not.toHaveBeenCalled();
  });

  it("does not replace an inaccessible selected filesystem folder with the private default", async () => {
    mocks.platform.OS = "ios";
    mocks.settings.set("backupFolderUri", "file:///selected-backups/");
    mocks.getInfo.mockRejectedValueOnce(nativeFailure);

    expect(await createBackup()).toMatchObject({ success: false, error: expect.stringContaining("selected backup folder") });
    expect(mocks.makeDirectory).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it("uses private default storage on iOS when no external folder was selected", async () => {
    mocks.platform.OS = "ios";
    mocks.settings.delete("backupFolderUri");

    expect(await createBackup()).toEqual({ success: true, data: `${PRIVATE_FOLDER}moodinator-backup-2026-10-08.json` });
    expect(mocks.files.get(`${PRIVATE_FOLDER}moodinator-backup-2026-10-08.json`)).toBe(JSON_DATA);
  });

  it("hides a private write exception and permits retry after storage recovers", async () => {
    mocks.platform.OS = "ios";
    mocks.settings.delete("backupFolderUri");
    mocks.writeFile.mockRejectedValueOnce(nativeFailure);

    const result = await createBackup();

    expect(result).toMatchObject({ success: false, error: expect.stringContaining("try again") });
    expect(JSON.stringify(result)).not.toContain(nativeFailure.message);
    expect(mocks.settings.has("lastBackupTimestamp")).toBe(false);
    expect(await createBackup()).toMatchObject({ success: true });
  });
});
