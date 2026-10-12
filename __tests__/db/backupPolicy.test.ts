import { describe, expect, it } from "vitest";

import {
  getBackupFilename,
  parseBackupFilename,
  parseBackupUri,
  selectBackupsForDeletion,
} from "../../db/backupPolicy";

describe("backupPolicy", () => {
  it("creates stable date-based backup filenames", () => {
    expect(getBackupFilename(Date.UTC(2026, 0, 15, 12))).toBe(
      "moodinator-backup-2026-01-15.json"
    );
  });

  it("parses filesystem and SAF backup names", () => {
    expect(
      parseBackupFilename(
        "moodinator-backup-2026-01-15.json",
        "file:///backups/moodinator-backup-2026-01-15.json"
      )
    ).toMatchObject({
      filename: "moodinator-backup-2026-01-15.json",
      timestamp: Date.UTC(2026, 0, 15),
    });

    expect(
      parseBackupUri(
        "content://tree/backups/document/moodinator-backup-2026-01-16.json"
      )
    ).toMatchObject({
      filename: "moodinator-backup-2026-01-16.json",
      timestamp: Date.UTC(2026, 0, 16),
    });
  });

  it("keeps the newest backups by retention count", () => {
    const backups = Array.from({ length: 10 }, (_, index) => ({
      filename: `moodinator-backup-2026-01-${String(index + 1).padStart(2, "0")}.json`,
      timestamp: Date.UTC(2026, 0, index + 1),
      uri: `file://${index}`,
    }));

    expect(selectBackupsForDeletion(backups, 8).map((file) => file.filename)).toEqual([
      "moodinator-backup-2026-01-02.json",
      "moodinator-backup-2026-01-01.json",
    ]);
  });

  it("preserves physical duplicate names in filesystem and encoded SAF paths", () => {
    const filename = "moodinator-backup-2026-10-08 (2).json";
    const uri = `content://provider/tree/primary%3ABackups/document/${encodeURIComponent(`primary:Backups/${filename}`)}`;

    expect(parseBackupUri(uri)).toEqual({
      uri,
      filename,
      timestamp: Date.UTC(2026, 9, 8),
    });
    expect(parseBackupFilename(filename, `file:///backups/${filename}`)?.filename).toBe(filename);
  });

  it.each([
    "moodinator-export-full-2026-10-08.json",
    "moodinator-backup-2026-10-08.txt",
    "moodinator-backup-2026-10-08.json.bak",
    "copy-moodinator-backup-2026-10-08.json",
    "moodinator-backup-2026-02-30.json",
    "moodinator-backup-2026-13-01.json",
    "moodinator-backup-2026-10-08 (draft).json",
  ])("does not classify unrelated or invalid names as managed backups: %s", (filename) => {
    expect(parseBackupFilename(filename, `file:///backups/${filename}`)).toBeNull();
    expect(parseBackupUri(`content://provider/document/${encodeURIComponent(filename)}`)).toBeNull();
  });

  it("ignores a malformed URI and a backup-named parent folder", () => {
    expect(parseBackupUri("content://provider/document/invalid%uri")).toBeNull();
    expect(parseBackupUri("content://provider/moodinator-backup-2026-10-08.json/export.json")).toBeNull();
  });

  it("counts same-day physical files and preserves the one just written", () => {
    const files = Array.from({ length: 10 }, (_, index) => ({
      filename: `moodinator-backup-2026-10-08 (${index + 1}).json`,
      timestamp: Date.UTC(2026, 9, 8),
      uri: `content://provider/document/${index}`,
    }));
    const createdUri = files[9].uri;
    const deleted = selectBackupsForDeletion(files, 8, createdUri);

    expect(deleted).toHaveLength(2);
    expect(deleted.map((file) => file.uri)).not.toContain(createdUri);
    // Existing enumeration order breaks date ties; suffixes are not creation times.
    expect(deleted).toEqual(files.slice(7, 9));
  });
});
