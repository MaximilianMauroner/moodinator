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
});
