import { createMoodQueryFamily } from "./moodQueryCache";
import { moodService, type MoodDateRange } from "./moodService";

export const moodQueries = {
  range: createMoodQueryFamily(
    (range: MoodDateRange | undefined) => JSON.stringify(range ?? null),
    (range) => moodService.getInRange(range),
  ),
  month: createMoodQueryFamily(
    ({ year, month }: { year: number; month: number }) => `${year}:${month}`,
    ({ year, month }) => moodService.getByMonth(year, month),
  ),
  summary: createMoodQueryFamily(
    () => "history-summary",
    () => moodService.getHistorySummary(),
  ),
  recent: createMoodQueryFamily(
    (limit: number) => String(limit),
    (limit) => moodService.getPaginated({ limit, offset: 0 }),
  ),
};
