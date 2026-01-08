export type MoodRangePreset = "week" | "twoWeeks" | "month";

export type MoodDateRange =
  | { preset: MoodRangePreset }
  | { startDate: number; endDate: number };

export function resolveDateRange(range?: MoodDateRange) {
  if (!range) {
    return {};
  }
  if ("preset" in range) {
    const now = Date.now();
    const days =
      range.preset === "week" ? 7 : range.preset === "twoWeeks" ? 14 : 30;
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));
    return { startDate: startDate.getTime(), endDate: now };
  }
  return {
    startDate: range.startDate,
    endDate: range.endDate,
  };
}

