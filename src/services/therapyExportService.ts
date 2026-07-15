import type { MoodEntry } from "@db/types";
import type { TherapyExportField } from "@/lib/entrySettings";
import { getMoodRatingLabel } from "@/constants/moodScaleInterpretation";

function csvEscape(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
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
