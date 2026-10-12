import { afterEach, describe, expect, it } from "vitest";

import { buildTherapyExportCsv } from "../../src/services/therapyExportService";
import { createMockMoodEntry } from "../db/mockClient";

describe("therapyExportService", () => {
  describe("recorded timestamps", () => {
    const originalTimezone = process.env.TZ;

    afterEach(() => {
      if (originalTimezone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTimezone;
      }
    });

    it.each([
      [0, "2026-10-08T23:48:29Z"],
      [-120, "2026-10-09T01:48:29Z"],
      [420, "2026-10-08T16:48:29Z"],
      [-330, "2026-10-09T05:18:29Z"],
      [210, "2026-10-08T20:18:29Z"],
    ])("keeps captured offset %i stable after timezone travel", (utcOffsetMinutes, wallClock) => {
      const entry = createMockMoodEntry({
        timestamp: Date.parse("2026-10-08T23:48:29Z"),
        utcOffsetMinutes,
      });
      const expected = new Date(wallClock).toLocaleString(undefined, { timeZone: "UTC" });
      const exports = ["Europe/Vienna", "America/Los_Angeles", "Asia/Kolkata"].map((timezone) => {
        process.env.TZ = timezone;
        return buildTherapyExportCsv([entry], ["timestamp"]);
      });

      expect(new Set(exports).size).toBe(1);
      expect(exports[0]).toContain(expected);
      expect(entry.timestamp).toBe(Date.parse("2026-10-08T23:48:29Z"));
      expect(entry.utcOffsetMinutes).toBe(utcOffsetMinutes);
    });

    it("preserves a recorded clock time inside the device's daylight-saving gap", () => {
      process.env.TZ = "America/New_York";
      const entry = createMockMoodEntry({
        timestamp: Date.parse("2026-03-08T02:30:00Z"),
        utcOffsetMinutes: 0,
      });
      const expected = new Date("2026-03-08T02:30:00Z").toLocaleString(undefined, { timeZone: "UTC" });

      expect(buildTherapyExportCsv([entry], ["timestamp"])).toContain(expected);
    });

    it("preserves the previous calendar day at a western half-hour offset", () => {
      process.env.TZ = "Asia/Tokyo";
      const entry = createMockMoodEntry({
        timestamp: Date.parse("2026-10-09T00:15:00Z"),
        utcOffsetMinutes: 210,
      });
      const expected = new Date("2026-10-08T20:45:00Z").toLocaleString(undefined, { timeZone: "UTC" });

      expect(buildTherapyExportCsv([entry], ["timestamp"])).toContain(expected);
    });

    it("keeps the current-device timezone fallback for legacy entries", () => {
      const entry = createMockMoodEntry({ timestamp: Date.parse("2026-10-08T23:48:29Z"), utcOffsetMinutes: null });
      const exports = ["Europe/Vienna", "America/Los_Angeles"].map((timezone) => {
        process.env.TZ = timezone;
        const csv = buildTherapyExportCsv([entry], ["timestamp", "notes", "energy"]);
        expect(csv.split("\n")[0]).toBe("Timestamp,Notes,Energy Level");
        expect(csv).toContain(new Date(entry.timestamp).toLocaleString());
        return csv;
      });

      expect(exports[0]).not.toBe(exports[1]);
    });

    it("retains existing CSV output for unreadable and invalid timestamps", () => {
      process.env.TZ = "Europe/Vienna";
      const unreadable = createMockMoodEntry({ timestamp: 0, utcOffsetMinutes: null });
      const invalid = createMockMoodEntry({ timestamp: Number.NaN, utcOffsetMinutes: null });

      expect(buildTherapyExportCsv([unreadable], ["timestamp"])).toContain(new Date(0).toLocaleString());
      expect(buildTherapyExportCsv([invalid], ["timestamp"])).toBe("Timestamp\n");
    });
  });

  it("includes Mood Scale context whenever Mood Rating is exported", () => {
    const csv = buildTherapyExportCsv(
      [
        createMockMoodEntry({
          mood: 9,
          moodScale: {
            version: 2,
            min: 0,
            max: 10,
            lowerIsBetter: false,
          },
        }),
      ],
      ["mood"]
    );

    expect(csv.split("\n")[0]).toBe(
      "Mood Rating,Mood Rating Label,Mood Scale Version,Mood Scale Min,Mood Scale Max,Mood Scale Direction"
    );
    expect(csv.split("\n")[1]).toBe("9,Very Happy,2,0,10,Higher is better");
  });

  it("escapes spreadsheet text values", () => {
    const csv = buildTherapyExportCsv(
      [
        createMockMoodEntry({
          emotions: [{ name: 'Joy, "big"', category: "positive" }],
          note: "Line 1\nLine 2",
        }),
      ],
      ["emotions", "notes"]
    );

    expect(csv).toContain('"Joy, ""big""","Line 1\nLine 2"');
  });

  describe("spreadsheet formula neutralization", () => {
    const notesCsv = (note: string) =>
      buildTherapyExportCsv([createMockMoodEntry({ note })], ["notes"]).split("\n")[1];

    it.each([
      ["=HYPERLINK(\"http://example.invalid\",\"click\")"],
      ["+1+1"],
      ["@SUM(A1)"],
      ["-2+3"],
      ["\tleading tab"],
      ["\rleading carriage return"],
    ])("quotes and prefixes a note starting with a formula lead: %j", (note) => {
      expect(notesCsv(note)).toBe(`"'${note.replace(/"/g, '""')}"`);
    });

    /**
     * A spreadsheet may trim a leading line feed on import and evaluate what
     * follows, so it is neutralized alongside tab and carriage return. The
     * note itself spans lines, so this asserts on the whole file rather than
     * on a split row.
     */
    it("prefixes a formula hidden behind a leading line feed", () => {
      const note = '\n=HYPERLINK("http://example.invalid","click")';
      const csv = buildTherapyExportCsv(
        [createMockMoodEntry({ note })],
        ["notes"]
      );

      expect(csv.endsWith(`"'${note.replace(/"/g, '""')}"`)).toBe(true);
    });

    it("guards a formula lead in the emotions column too", () => {
      const csv = buildTherapyExportCsv(
        [createMockMoodEntry({ emotions: [{ name: "=cmd", category: "neutral" }] })],
        ["emotions"]
      );

      expect(csv.split("\n")[1]).toBe(`"'=cmd"`);
    });

    /**
     * A formula parser accepts whitespace after a unary minus, so "- 2+3"
     * evaluates. Every leading minus is guarded rather than guessing which ones
     * are prose, which costs a visible apostrophe on dashed list items.
     */
    it("guards every leading minus, including one behind whitespace", () => {
      expect(notesCsv("- 2+3")).toBe(`"'- 2+3"`);
      expect(notesCsv("- bullet point")).toBe(`"'- bullet point"`);
      expect(notesCsv("-")).toBe(`"'-"`);
    });

    it("leaves ordinary text untouched", () => {
      expect(notesCsv("Felt okay today")).toBe("Felt okay today");
      expect(notesCsv("Slept well, mostly")).toBe(`"Slept well, mostly"`);
    });


    it("does not guard numeric columns", () => {
      const csv = buildTherapyExportCsv(
        [createMockMoodEntry({ mood: 3, energy: 7 })],
        ["energy"]
      );

      expect(csv.split("\n")[1]).toBe("7");
    });
  });
});
