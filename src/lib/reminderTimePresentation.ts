export function formatReminderTime(
  hour: number,
  minute: number,
  languageTag: string,
  uses24hourClock: boolean | null
): string {
  const time = new Date(2000, 0, 1, hour, minute, 0, 0);
  return new Intl.DateTimeFormat(languageTag, {
    hour: "2-digit",
    minute: "2-digit",
    ...(uses24hourClock === null ? {} : { hour12: !uses24hourClock }),
  }).format(time);
}
