import { describe, expect, it } from 'vitest';
import { ALL_REMINDER_DAYS, formatReminderDays, normalizeReminderDays } from '../../src/lib/reminderDays';

describe('reminder days', () => {
    it('treats missing legacy days as daily and returns independent arrays', () => {
        const days = normalizeReminderDays();
        expect(days).toEqual(ALL_REMINDER_DAYS);
        days.pop();
        expect(normalizeReminderDays()).toHaveLength(7);
        expect(formatReminderDays(undefined, 'en-US')).toBe('Every day');
    });

    it('sorts and deduplicates without changing the input', () => {
        const days = [7, 2, 2, 1];
        expect(normalizeReminderDays(days)).toEqual([1, 2, 7]);
        expect(days).toEqual([7, 2, 2, 1]);
    });

    it.each([[], [0], [8], [-1], [1.5], [NaN], [Infinity]].map((days) => ({ days })))('rejects invalid days %j', ({ days }) => {
        expect(() => normalizeReminderDays(days)).toThrow();
    });

    it('formats Expo weekdays in the requested locale using fixed calendar days', () => {
        expect(formatReminderDays([1, 2, 7], 'en-US')).toBe('Sun, Mon, Sat');
        const formatter = new Intl.DateTimeFormat('de-AT', { weekday: 'short' });
        expect(formatReminderDays([2, 4], 'de-AT')).toBe(
            [new Date(2024, 0, 8, 12), new Date(2024, 0, 10, 12)].map((date) => formatter.format(date)).join(', ')
        );
        expect(formatReminderDays([7, 6, 5, 4, 3, 2, 1], 'en-US')).toBe('Every day');
    });
});
