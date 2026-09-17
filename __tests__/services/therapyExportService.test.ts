import { describe, expect, it } from "vitest";

import { buildTherapyExportCsv } from "../../src/services/therapyExportService";
import { createMockMoodEntry } from "../db/mockClient";

describe("therapyExportService", () => {
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

    it("leaves ordinary text and dashed list items untouched", () => {
      expect(notesCsv("- bullet point")).toBe("- bullet point");
      expect(notesCsv("-")).toBe("-");
      expect(notesCsv("Felt okay today")).toBe("Felt okay today");
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
