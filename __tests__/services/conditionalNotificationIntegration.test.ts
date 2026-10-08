import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    setNotificationHandler: vi.fn(),
    getPermissionsAsync: vi.fn(),
    requestPermissionsAsync: vi.fn(),
    getAllScheduledNotificationsAsync: vi.fn(),
    cancelScheduledNotificationAsync: vi.fn(),
    scheduleNotificationAsync: vi.fn(),
    getLastNotificationResponseAsync: vi.fn(),
    cancelAllScheduledNotificationsAsync: vi.fn(),
    SchedulableTriggerInputTypes: { DAILY: 'daily', WEEKLY: 'weekly', DATE: 'date', TIME_INTERVAL: 'timeInterval' },
    IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
}));
const moods = vi.hoisted(() => ({ getInRange: vi.fn(), clearAll: vi.fn(), invalidate: vi.fn() }));
vi.mock('../../src/shared/state/moodsStore', () => ({ useMoodsStore: { getState: () => ({ invalidate: moods.invalidate }) } }));
vi.mock('expo-notifications', () => mocks);
vi.mock('expo-localization', () => ({ getCalendars: () => [{ timeZone: 'Etc/UTC' }] }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('../../src/services/moodService', () => ({ moodService: moods }));

const requests = new Map<string, { identifier: string; content: { title?: string; data?: Record<string, unknown> }; trigger?: { type: string; weekday?: number } }>();
async function load() {
    vi.resetModules();
    return import('../../src/services/notificationService');
}
const choice = { enabled: true, hour: 21, minute: 0 };
const ordinary = { title: 'How are you feeling?', body: 'Check in', ...choice };

describe('conditional notification service integration', () => {
    beforeEach(async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 8, 26, 10));
        vi.clearAllMocks();
        vi.doMock('expo-notifications', () => mocks);
        await AsyncStorage.clear();
        requests.clear();
        moods.getInRange.mockResolvedValue([]);
        moods.clearAll.mockImplementation(async () => {
            const service = await import('../../src/services/notificationService');
            await service.reconcileNoEntryReminder();
        });
        mocks.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
        mocks.getLastNotificationResponseAsync.mockResolvedValue(null);
        mocks.getAllScheduledNotificationsAsync.mockImplementation(async () => [...requests.values()]);
        mocks.cancelScheduledNotificationAsync.mockImplementation(async (id) => { requests.delete(id); });
        mocks.cancelAllScheduledNotificationsAsync.mockImplementation(async () => { requests.clear(); });
        let counter = 0;
        mocks.scheduleNotificationAsync.mockImplementation(async (request) => {
            const identifier = request.identifier ?? `ordinary-${++counter}`;
            if (!requests.has(identifier) && requests.size >= 64) throw new Error('Native request limit reached');
            requests.set(identifier, { ...request, identifier });
            return identifier;
        });
    });
    afterEach(() => { vi.useRealTimers(); });

    it('serializes conditional and ordinary changes, refreshing collision dates after deletion', async () => {
        const service = await load();
        const [, daily] = await Promise.all([
            service.saveNoEntryReminderSettings(choice),
            service.addNotification(ordinary),
        ]);
        expect(requests.size).toBe(1);
        expect([...requests.values()][0].content.data?.type).toBe('mood-reminder');
        await service.deleteNotification(daily.id);
        expect(requests.size).toBe(14);
        expect([...requests.values()].every((request) => request.content.data?.type === 'no-entry-reminder')).toBe(true);
    });

    it('does not let ordinary cleanup cancel unchanged conditional requests', async () => {
        const service = await load();
        await service.saveNoEntryReminderSettings(choice);
        mocks.cancelScheduledNotificationAsync.mockClear();
        await service.addNotification({ ...ordinary, hour: 20 });
        expect(mocks.cancelScheduledNotificationAsync.mock.calls.some(([id]) => id.startsWith('no-entry-'))).toBe(false);
        expect(requests.size).toBe(15);
    });

    it('refreshes conditional requests during ordinary startup/resume recovery', async () => {
        const service = await load();
        await service.saveNoEntryReminderSettings(choice);
        moods.getInRange.mockResolvedValue([{ timestamp: +new Date(2026, 8, 26, 11) }]);
        await service.ensureMoodReminderScheduled();
        expect(requests.has('no-entry-2026-09-26')).toBe(false);
        expect(requests.size).toBe(13);
        expect(mocks.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('checks saved entries before foreground display while ordinary notifications stay visible', async () => {
        const service = await load();
        await service.saveNoEntryReminderSettings(choice);
        const handler = mocks.setNotificationHandler.mock.calls[0][0];
        const request = requests.get('no-entry-2026-09-26');
        expect(await handler.handleNotification({ request })).toMatchObject({ shouldShowBanner: true, shouldShowList: true });
        moods.getInRange.mockResolvedValue([{ timestamp: +new Date(2026, 8, 26, 11) }]);
        expect(await handler.handleNotification({ request })).toMatchObject({ shouldShowBanner: false, shouldShowList: false });
        expect(await handler.handleNotification({ request: { content: { data: { type: 'mood-reminder' } } } })).toMatchObject({ shouldShowBanner: true });
    });

    it('reserves a whole weekly set when conditional reminders fill the native 64-request limit', async () => {
        const service = await load();
        for (let i = 0; i < 50; i++) requests.set(`other-${i}`, { identifier: `other-${i}`, content: {} });
        await service.saveNoEntryReminderSettings(choice);
        expect(requests.size).toBe(64);
        const weekly = await service.addNotification({ ...ordinary, hour: 20, weekdays: [1, 3, 7] });
        expect(weekly.scheduleStatus).toBe('scheduled');
        expect(weekly.scheduledIds).toHaveLength(3);
        expect(requests.size).toBe(64);
        expect([...requests.values()].filter((request) => request.content.data?.type === 'no-entry-reminder')).toHaveLength(11);
        expect(await service.getNoEntryReminderSettings()).toMatchObject({ status: 'limited' });
    });

    it('still schedules independent ordinary reminders when the full desired set exceeds capacity', async () => {
        const service = await load();
        for (let i = 0; i < 63; i++) requests.set(`other-${i}`, { identifier: `other-${i}`, content: {} });
        await service.saveNoEntryReminderSettings(choice);
        const result = await service.saveAllNotifications([
            { ...ordinary, id: 'first', hour: 19 },
            { ...ordinary, id: 'second', hour: 20 },
        ]);
        expect(result.status).toBe('partial-failure');
        expect(result.notifications.map((reminder) => reminder.scheduleStatus)).toEqual(['scheduled', 'failed']);
        expect(requests.size).toBe(64);
    });

    it('persists the desired ordinary set when capacity cleanup fails, then retries without partial weekly requests', async () => {
        const service = await load();
        for (let i = 0; i < 50; i++) requests.set(`other-${i}`, { identifier: `other-${i}`, content: {} });
        await service.saveNoEntryReminderSettings(choice);
        mocks.cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error('Native cleanup blocked'));
        const weekly = await service.addNotification({ ...ordinary, hour: 20, weekdays: [1, 3, 7] });
        expect(weekly).toMatchObject({ enabled: true, weekdays: [1, 3, 7], scheduleStatus: 'failed' });
        expect([...requests.values()].filter((request) => request.content.data?.type === 'mood-reminder')).toHaveLength(0);
        expect((await service.getNoEntryReminderSettings()).retainedIds.length).toBeGreaterThan(0);
        await service.ensureMoodReminderScheduled();
        expect((await service.getAllNotifications())[0].scheduleStatus).toBe('scheduled');
        expect([...requests.values()].filter((request) => request.content.data?.type === 'mood-reminder')).toHaveLength(3);
        expect(requests.size).toBe(64);
    });

    it('uses partial rollback survivors as collisions, and cleans them on ordinary retry', async () => {
        const service = await load();
        await service.saveNoEntryReminderSettings(choice);
        const schedule = mocks.scheduleNotificationAsync.getMockImplementation()!;
        const cancel = mocks.cancelScheduledNotificationAsync.getMockImplementation()!;
        let fail = true;
        mocks.scheduleNotificationAsync.mockImplementation(async (request) => {
            if (fail && request.trigger.type === 'weekly' && request.trigger.weekday === 7) throw new Error('Partial week rejected');
            return schedule(request);
        });
        mocks.cancelScheduledNotificationAsync.mockImplementation(async (id) => {
            if (fail && requests.get(id)?.trigger?.type === 'weekly') throw new Error('Rollback failed');
            return cancel(id);
        });
        const weekly = await service.addNotification({ ...ordinary, weekdays: [1, 7] });
        expect(weekly.scheduleStatus).toBe('failed');
        expect(weekly.scheduledIds).toHaveLength(1);
        expect(requests.has('no-entry-2026-09-26')).toBe(true);
        expect(requests.has('no-entry-2026-09-27')).toBe(false);
        fail = false;
        await service.ensureMoodReminderScheduled();
        expect((await service.getAllNotifications())[0].scheduleStatus).toBe('scheduled');
        expect([...requests.values()].filter((request) => request.content.data?.type === 'mood-reminder')).toHaveLength(2);
        expect(requests.has('no-entry-2026-09-26')).toBe(false);
        expect(requests.has('no-entry-2026-09-27')).toBe(false);
    });

    it('restores conditional fallback after ordinary scheduling fails with a successful rollback', async () => {
        const service = await load();
        for (let i = 0; i < 50; i++) requests.set(`other-${i}`, { identifier: `other-${i}`, content: {} });
        await service.saveNoEntryReminderSettings(choice);
        const schedule = mocks.scheduleNotificationAsync.getMockImplementation()!;
        mocks.scheduleNotificationAsync.mockImplementation(async (request) => {
            if (request.trigger.type === 'weekly' && request.trigger.weekday === 7) throw new Error('Week rejected');
            return schedule(request);
        });
        const weekly = await service.addNotification({ ...ordinary, weekdays: [1, 7] });
        expect(weekly.scheduleStatus).toBe('failed');
        expect(weekly.scheduledIds).toBeUndefined();
        expect([...requests.values()].filter((request) => request.content.data?.type === 'mood-reminder')).toHaveLength(0);
        expect([...requests.values()].filter((request) => request.content.data?.type === 'no-entry-reminder')).toHaveLength(14);
        expect(requests.size).toBe(64);
    });

    it('requires confirmed native cancellation before allowing a destructive reset to proceed', async () => {
        const service = await load();
        requests.set('other', { identifier: 'other', content: {} });
        mocks.cancelAllScheduledNotificationsAsync.mockResolvedValueOnce(undefined);
        await expect(service.cancelAllScheduledNotifications()).rejects.toThrow('Some scheduled notifications remain');
        await expect(service.cancelAllScheduledNotifications()).resolves.toBeUndefined();
        vi.doMock('expo-notifications', () => { throw new Error('Native unavailable'); });
        const unavailable = await load();
        await expect(unavailable.cancelAllScheduledNotifications()).rejects.toThrow('existing reminders could not be cleared');
    });

    it('accepts conditional taps for the same home navigation path', async () => {
        const service = await load();
        const response = (type: string) => ({ notification: { request: { content: { data: { type } } } } });
        expect(service.isMoodReminderResponse(response('no-entry-reminder'))).toBe(true);
        expect(service.isMoodReminderResponse(response('mood-reminder'))).toBe(true);
        expect(service.isMoodReminderResponse(response('backup'))).toBe(false);
    });
    it('excludes concurrent writes throughout full reset without deadlocking mood reconciliation', async () => {
        const service = await load();
        const { resetDeveloperAppData } = await import('../../src/services/developerResetService');
        await service.saveNoEntryReminderSettings(choice);
        await service.addNotification({ ...ordinary, hour: 20 });
        let releasePin!: () => void;
        let enteredPin!: () => void;
        const pinEntered = new Promise<void>((resolve) => { enteredPin = resolve; });
        const pinWait = new Promise<void>((resolve) => { releasePin = resolve; });
        const reset = resetDeveloperAppData(async () => { enteredPin(); await pinWait; });
        await pinEntered;
        expect(requests.size).toBe(0);
        expect(await service.scheduleTestNotification()).toBe(false);
        await expect(service.addNotification(ordinary)).rejects.toThrow('reset is in progress');
        await expect(service.saveNoEntryReminderSettings(choice)).rejects.toThrow('reset is in progress');
        await expect(service.saveAllNotifications([])).rejects.toThrow('reset is in progress');
        await expect(service.withNotificationReset(async () => undefined)).rejects.toThrow('reset is in progress');
        releasePin();
        await reset;
        expect(moods.clearAll).toHaveBeenCalledOnce();
        expect(moods.invalidate).toHaveBeenCalledOnce();
        expect(requests.size).toBe(0);
        expect(await AsyncStorage.getItem('noEntryReminderSettings')).toBeNull();
        expect(await service.scheduleTestNotification()).toBe(true);
    });

    it('excludes queued writers when reset starts and releases exclusion after reset failure', async () => {
        const service = await load();
        const queued = service.addNotification(ordinary);
        const queuedRejected = expect(queued).rejects.toThrow('reset is in progress');
        const reset = service.withNotificationReset(async () => { throw new Error('Reset failed'); });
        await expect(reset).rejects.toThrow('Reset failed');
        await queuedRejected;
        expect(requests.size).toBe(0);
        expect(await service.scheduleTestNotification()).toBe(true);
    });

});
