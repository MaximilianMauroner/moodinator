/** Expo calendar weekdays: Sunday = 1 through Saturday = 7. */
export const ALL_REMINDER_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Missing days are legacy daily reminders. Explicit empty/invalid days reject. */
export function normalizeReminderDays(days?: readonly number[]): number[] {
    if (days === undefined) return [...ALL_REMINDER_DAYS];
    if (!Array.isArray(days) || days.length === 0
        || days.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
        throw new Error('Select at least one valid reminder day (1 = Sunday through 7 = Saturday).');
    }
    return [...new Set(days)].sort((a, b) => a - b);
}

export function formatReminderDays(days?: readonly number[], languageTag?: string): string {
    const normalized = normalizeReminderDays(days);
    if (normalized.length === 7) return 'Every day';
    const formatter = new Intl.DateTimeFormat(languageTag, { weekday: 'short', timeZone: 'UTC' });
    // January 7, 2024 was Sunday; fixed UTC dates prevent timezone day shifts.
    return normalized.map((day) => formatter.format(new Date(Date.UTC(2024, 0, 6 + day)))).join(', ');
}
