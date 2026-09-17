import type { MoodEntry } from "@db/types";
import type { TherapyExportField } from "@/lib/entrySettings";
import { getMoodRatingLabel } from "@/constants/moodScaleInterpretation";

// Therapy exports are opened in a spreadsheet by someone other than the author,
// so a cell that starts a formula would evaluate on their machine. Notes can
// carry arbitrary text, including text that arrived through a JSON import.
// The control characters are here because a spreadsheet may trim them while
// importing and evaluate what follows, so a line feed counts alongside tab and
// carriage return.
//
// A leading "-" is guarded without trying to tell a dash from a negation.
// Formula parsers accept whitespace after a unary minus, so "- 2+3" evaluates,
// and any rule written to keep dashed prose clean leaves a hole somewhere. A
// dashed list item is exported with a visible apostrophe as a result, which is
// the cost of not guessing.
const FORMULA_LEAD = /^[=+@\-\t\r\n]/;

function csvEscape(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }
  // A number cannot be a formula, and prefixing one would turn a numeric column
  // into text for the person reading the export.
  if (typeof value === "number") {
    return String(value);
  }
  const str = value;
  const startsFormula = FORMULA_LEAD.test(str);
  // The apostrophe forces text in Excel and Sheets and stays hidden in the cell.
  const body = startsFormula ? `'${str}` : str;
  if (startsFormula || /[",\n\r]/.test(body)) {
    return `"${body.replace(/"/g, '""')}"`;
  }
  return body;
}

function formatTimestamp(value: number) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

type CsvColumn = {
  header: string;
  value: string | number | null | undefined;
};

const FIELD_HEADERS: Record<TherapyExportField, string[]> = {
  timestamp: ["Timestamp"],
  mood: [
    "Mood Rating",
    "Mood Rating Label",
    "Mood Scale Version",
    "Mood Scale Min",
    "Mood Scale Max",
    "Mood Scale Direction",
  ],
  emotions: ["Emotions"],
  context: ["Context Tags"],
  energy: ["Energy Level"],
  notes: ["Notes"],
};

function resolveFieldColumns(entry: MoodEntry, field: TherapyExportField): CsvColumn[] {
  switch (field) {
    case "timestamp":
      return [{ header: "Timestamp", value: formatTimestamp(entry.timestamp) }];
    case "mood":
      return [
        { header: "Mood Rating", value: entry.mood },
        {
          header: "Mood Rating Label",
          value: getMoodRatingLabel(entry.mood, entry.moodScale),
        },
        { header: "Mood Scale Version", value: entry.moodScale.version },
        { header: "Mood Scale Min", value: entry.moodScale.min },
        { header: "Mood Scale Max", value: entry.moodScale.max },
        {
          header: "Mood Scale Direction",
          value: entry.moodScale.lowerIsBetter ? "Lower is better" : "Higher is better",
        },
      ];
    case "emotions":
      return [
        {
          header: "Emotions",
          value: entry.emotions.map((emotion) => emotion.name).join("; "),
        },
      ];
    case "context":
      return [{ header: "Context Tags", value: entry.contextTags.join("; ") }];
    case "energy":
      return [{ header: "Energy Level", value: entry.energy ?? "" }];
    case "notes":
      return [{ header: "Notes", value: entry.note ?? "" }];
    default:
      return [];
  }
}

export function buildTherapyExportCsv(
  rows: MoodEntry[],
  fields: TherapyExportField[]
) {
  const header = fields.flatMap((field) => FIELD_HEADERS[field] ?? []);
  const body = rows.map((entry) =>
    fields.flatMap((field) => resolveFieldColumns(entry, field).map((column) => csvEscape(column.value)))
  );

  return [header, ...body].map((cells) => cells.join(",")).join("\n");
}
