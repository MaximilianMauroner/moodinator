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
});
