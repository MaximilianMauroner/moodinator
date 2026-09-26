import type * as ExpoNotifications from 'expo-notifications';
import {
    createNoEntryReminderPlan,
    getLocalDayKey,
    NO_ENTRY_REMINDER_HORIZON_DAYS,
    NO_ENTRY_REMINDER_ID_PREFIX,
    type OrdinaryReminderForPlan,
} from '../lib/noEntryReminderPlan';

export const NO_ENTRY_REMINDER_TAG = 'no-entry-reminder';
export const NO_ENTRY_REMINDER_SETTINGS_KEY = 'noEntryReminderSettings';
const CLEANUP_WARNING = 'Some earlier reminders may still arrive. Open Moodinator to retry cleanup.';

type NotificationsModule = Pick<typeof ExpoNotifications,
    'getAllScheduledNotificationsAsync' | 'cancelScheduledNotificationAsync'
    | 'scheduleNotificationAsync' | 'SchedulableTriggerInputTypes'>;
type AccessResult =
    | { ok: true; notifications: NotificationsModule }
    | { ok: false; status: 'permission-denied' | 'unavailable' | 'failed'; message: string };
export type NoEntryReminderSettings = {
    enabled: boolean;
    hour: number;
    minute: number;
    status: 'disabled' | 'scheduled' | 'permission-denied' | 'unavailable' | 'failed' | 'limited';
    message: string | null;
    scheduledThroughDayKey: string | null;
    /** Native requests still owned by this feature, including failed cancellations. */
    retainedIds: string[];
};
export type NoEntryReminderDependencies = {
    storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> };
    getAccess(mode: 'request' | 'check-only'): Promise<AccessResult>;
    getModule(): Promise<NotificationsModule | null>;
    getEntryTimestamps(start: Date, end: Date): Promise<readonly number[]>;
    now(): Date;
    getTimeZone(): string;
};

function defaults(): NoEntryReminderSettings {
    return { enabled: false, hour: 21, minute: 0, status: 'disabled', message: null,
        scheduledThroughDayKey: null, retainedIds: [] };
}
function validTime(hour: number, minute: number): boolean {
    return Number.isInteger(hour) && hour >= 0 && hour <= 23
        && Number.isInteger(minute) && minute >= 0 && minute <= 59;
}
function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Could not update conditional reminders.';
}
function dayBounds(now: Date, days: number): [Date, Date] {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    return [start, end];
}

type NativeRequest = Awaited<ReturnType<NotificationsModule['getAllScheduledNotificationsAsync']>>[number];
function isConditional(request: NativeRequest): boolean {
    return request.identifier.startsWith(NO_ENTRY_REMINDER_ID_PREFIX)
        || request.content.data?.type === NO_ENTRY_REMINDER_TAG;
}

/** Expo serializes Android daily/weekly triggers directly and iOS as calendar components. */
function nativeOrdinaryPlan(request: NativeRequest, timeZone: string): OrdinaryReminderForPlan | null {
    // SDK55 types include calendar input, but native output has dateComponents.
    const trigger = request.trigger as ExpoNotifications.NotificationTrigger | ExpoNotifications.CalendarNotificationTrigger;
    if (!trigger || !('type' in trigger)) return null;
    let hour: number;
    let minute: number;
    let weekday: number | undefined;
    if (trigger.type === 'daily' || trigger.type === 'weekly') {
        hour = trigger.hour;
        minute = trigger.minute;
        weekday = trigger.type === 'weekly' ? trigger.weekday : undefined;
    } else if (trigger.type === 'calendar' && trigger.repeats && 'dateComponents' in trigger) {
        const components = trigger.dateComponents;
        if (!components || typeof components !== 'object') return null;
        const constrained = ['era', 'year', 'month', 'day', 'weekdayOrdinal', 'quarter',
            'weekOfMonth', 'weekOfYear', 'yearForWeekOfYear'] as const;
        if (constrained.some((key) => components[key] != null)
            || (components.second != null && components.second !== 0)
            || (components.nanosecond != null && components.nanosecond !== 0)
            || components.calendar != null || components.isLeapMonth || components.isRepeatedDay
            || (components.timeZone != null && components.timeZone !== timeZone)) return null;
        hour = components.hour!;
        minute = components.minute!;
        weekday = components.weekday;
    } else return null;
    if (!validTime(hour, minute)
        || (weekday !== undefined && (!Number.isInteger(weekday) || weekday < 1 || weekday > 7))) return null;
    return { hour, minute, weekdays: weekday === undefined ? undefined : [weekday], enabled: true, scheduleStatus: 'scheduled' };
}

/** Caller serializes these methods with all other native notification mutations. */
export function createNoEntryReminderScheduler(deps: NoEntryReminderDependencies) {
    async function getSettings(): Promise<NoEntryReminderSettings> {
        const raw = await deps.storage.getItem(NO_ENTRY_REMINDER_SETTINGS_KEY);
        if (raw === null) return defaults();
        try {
            const value = JSON.parse(raw) as Partial<NoEntryReminderSettings> | null;
            if (!value || typeof value !== 'object') return defaults();
            const baseline = defaults();
            const timeValid = validTime(value.hour as number, value.minute as number);
            const statuses = ['disabled', 'scheduled', 'permission-denied', 'unavailable', 'failed', 'limited'];
            return {
                enabled: value.enabled === true,
                hour: timeValid ? value.hour! : baseline.hour,
                minute: timeValid ? value.minute! : baseline.minute,
                status: statuses.includes(value.status ?? '') ? value.status! : (value.enabled ? 'failed' : 'disabled'),
                message: typeof value.message === 'string' ? value.message : null,
                scheduledThroughDayKey: typeof value.scheduledThroughDayKey === 'string' ? value.scheduledThroughDayKey : null,
                retainedIds: Array.isArray(value.retainedIds)
                    ? value.retainedIds.filter((id): id is string => typeof id === 'string') : [],
            };
        } catch {
            return { ...defaults(), status: 'failed', message: 'Conditional reminder settings could not be read. Save your choice again.' };
        }
    }
    async function persist(settings: NoEntryReminderSettings): Promise<NoEntryReminderSettings> {
        await deps.storage.setItem(NO_ENTRY_REMINDER_SETTINGS_KEY, JSON.stringify(settings));
        return settings;
    }
    async function update(settings: NoEntryReminderSettings, mode: 'request' | 'check-only') {
        let retained = new Set(settings.retainedIds);
        try {
            let access: AccessResult | undefined;
            if (settings.enabled) access = await deps.getAccess(mode);
            const native = access?.ok ? access.notifications : await deps.getModule();
            if (!native) {
                return persist({ ...settings, status: access && !access.ok ? access.status : 'unavailable',
                    scheduledThroughDayKey: null,
                    message: `${access && !access.ok ? access.message : 'Notifications are unavailable on this device.'}${retained.size ? ` ${CLEANUP_WARNING}` : ''}` });
            }
            const scheduled = await native.getAllScheduledNotificationsAsync();
            const owned = scheduled.filter(isConditional);
            retained = new Set([...retained, ...owned.map((request) => request.identifier)]);
            const timeZone = deps.getTimeZone();
            const now = deps.now();
            const [start, end] = dayBounds(now, NO_ENTRY_REMINDER_HORIZON_DAYS);
            const canSchedule = settings.enabled && access?.ok;
            const plan = canSchedule ? createNoEntryReminderPlan({
                now: now.getTime(), hour: settings.hour, minute: settings.minute,
                entryTimestamps: await deps.getEntryTimestamps(start, end),
                ordinaryReminders: scheduled.flatMap((request) => {
                    if (request.content.data?.type !== 'mood-reminder'
                        && request.content.title !== 'How are you feeling?') return [];
                    if (isConditional(request)) return [];
                    const reminder = nativeOrdinaryPlan(request, timeZone);
                    return reminder ? [reminder] : [];
                }),
                capacity: Math.max(0, 64 - (scheduled.length - owned.length)),
            }) : null;
            const desired = new Map(plan?.requests.map((request) => [request.identifier, request]) ?? []);
            const unchanged = new Set(owned.filter((request) => {
                const target = desired.get(request.identifier);
                return target && request.content.data?.type === NO_ENTRY_REMINDER_TAG
                    && request.content.data?.dayKey === target.dayKey
                    && request.content.data?.fireAt === target.fireAt
                    && request.content.data?.timeZone === timeZone;
            }).map((request) => request.identifier));
            let cleanupFailed = false;
            for (const identifier of retained) {
                if (unchanged.has(identifier)) continue;
                try {
                    await native.cancelScheduledNotificationAsync(identifier);
                    retained.delete(identifier);
                } catch {
                    cleanupFailed = true;
                }
            }
            if (cleanupFailed) {
                return persist({ ...settings, status: 'failed', message: CLEANUP_WARNING,
                    scheduledThroughDayKey: null, retainedIds: [...retained] });
            }
            if (!plan) {
                return persist({ ...settings, status: access && !access.ok ? access.status : 'disabled',
                    message: access && !access.ok ? access.message : null,
                    scheduledThroughDayKey: null, retainedIds: [...retained] });
            }
            let schedulingFailed = false;
            let schedulingError: unknown;
            for (const request of plan.requests) {
                if (unchanged.has(request.identifier)) continue;
                // DB reads or cancellation can cross the chosen wall-clock time.
                // Never submit a past DATE request: the OS may deliver it at once.
                if (request.fireAt <= deps.now().getTime()) continue;
                // Stable identifiers let the next reconciliation discover native success
                // even if the OS call or the final storage write fails afterwards.
                retained.add(request.identifier);
                try {
                    await native.scheduleNotificationAsync({
                        identifier: request.identifier,
                        content: { title: 'A moment for your mood', body: 'If you have not checked in today, take a moment for yourself.',
                            data: { type: NO_ENTRY_REMINDER_TAG, dayKey: request.dayKey, fireAt: request.fireAt, timeZone } },
                        trigger: { type: native.SchedulableTriggerInputTypes.DATE, date: new Date(request.fireAt), channelId: 'default' },
                    });
                } catch (error) {
                    schedulingFailed = true;
                    schedulingError = error;
                    break;
                }
            }
            return persist({ ...settings,
                status: schedulingFailed ? 'failed' : plan.capacityLimited ? 'limited' : 'scheduled',
                message: schedulingFailed ? `Some reminders could not be scheduled. ${errorMessage(schedulingError)}`
                    : plan.capacityLimited ? 'Device notification capacity limits this reminder. Open Moodinator to refresh upcoming dates.' : null,
                scheduledThroughDayKey: schedulingFailed || plan.capacityLimited ? null : plan.horizonEndDayKey,
                retainedIds: [...retained],
            });
        } catch (error) {
            return persist({ ...settings, status: 'failed', scheduledThroughDayKey: null,
                message: `${errorMessage(error)}${retained.size ? ` ${CLEANUP_WARNING}` : ''}`, retainedIds: [...retained] });
        }
    }
    async function save(choice: Pick<NoEntryReminderSettings, 'enabled' | 'hour' | 'minute'>) {
        if (!validTime(choice.hour, choice.minute)) throw new RangeError('Choose a valid reminder time.');
        const previous = await getSettings();
        const desired = { ...previous, ...choice, status: 'failed' as const,
            message: 'Conditional reminders need to be reconciled.', scheduledThroughDayKey: null };
        // Persist intent before permission prompts or OS changes, including disable.
        await persist(desired);
        return update(desired, choice.enabled ? 'request' : 'check-only');
    }
    async function reconcile() {
        const settings = await getSettings();
        if (!settings.enabled && settings.status === 'disabled' && settings.retainedIds.length === 0) return settings;
        return update(settings, 'check-only');
    }
    /** Called after ordinary cleanup, before scheduling the complete replacement set. */
    async function reserveOrdinaryCapacity(native: NotificationsModule, requiredSlots: number): Promise<void> {
        const settings = await getSettings();
        if (!settings.enabled && settings.retainedIds.length === 0 && settings.status === 'disabled') return;
        const scheduled = await native.getAllScheduledNotificationsAsync();
        const conditional = scheduled.filter(isConditional)
            .sort((a, b) => b.identifier.localeCompare(a.identifier));
        // Free all possible conditional capacity; ordinary scheduling still reports
        // per-reminder partial success when the full desired set exceeds OS limits.
        const removeCount = Math.min(conditional.length, Math.max(0, scheduled.length + requiredSlots - 64));
        if (removeCount === 0) return;
        const retained = new Set([...settings.retainedIds, ...conditional.map((request) => request.identifier)]);
        let failed = false;
        for (const request of conditional.slice(0, removeCount)) {
            try {
                await native.cancelScheduledNotificationAsync(request.identifier);
                retained.delete(request.identifier);
            } catch {
                failed = true;
            }
        }
        await persist({ ...settings, retainedIds: [...retained], scheduledThroughDayKey: null,
            status: failed ? 'failed' : 'limited',
            message: failed ? CLEANUP_WARNING : 'Device notification capacity limits this reminder.' });
        if (failed) throw new Error('Could not safely free notification capacity. Some earlier reminders may still arrive.');
    }
    async function shouldPresent(data: Record<string, unknown>): Promise<boolean> {
        if (data.type !== NO_ENTRY_REMINDER_TAG) return true;
        try {
            const settings = await getSettings();
            const now = deps.now();
            const target = new Date(now);
            target.setHours(settings.hour, settings.minute, 0, 0);
            if (!settings.enabled || data.dayKey !== getLocalDayKey(now.getTime())
                || data.fireAt !== target.getTime() || data.timeZone !== deps.getTimeZone()) return false;
            const [start, end] = dayBounds(now, 1);
            return (await deps.getEntryTimestamps(start, end)).length === 0;
        } catch {
            return false;
        }
    }
    return { getSettings, save, reconcile, shouldPresent, reserveOrdinaryCapacity };
}
