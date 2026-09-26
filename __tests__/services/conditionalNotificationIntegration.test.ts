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
    SchedulableTriggerInputTypes: { DAILY: 'daily', WEEKLY: 'weekly', DATE: 'date' },
    IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
}));
const moods = vi.hoisted(() => ({ getInRange: vi.fn() }));
vi.mock('expo-notifications', () => mocks);
vi.mock('expo-localization', () => ({ getCalendars: () => [{ timeZone: 'Etc/UTC' }] }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('../../src/services/moodService', () => ({ moodService: moods }));

const requests = new Map<string, { identifier: string; content: { title?: string; data?: Record<string, unknown> } }>();
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
        await AsyncStorage.clear();
        requests.clear();
        moods.getInRange.mockResolvedValue([]);
        mocks.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
        mocks.getLastNotificationResponseAsync.mockResolvedValue(null);
        mocks.getAllScheduledNotificationsAsync.mockImplementation(async () => [...requests.values()]);
        mocks.cancelScheduledNotificationAsync.mockImplementation(async (id) => { requests.delete(id); });
        let counter = 0;
        mocks.scheduleNotificationAsync.mockImplementation(async (request) => {
            const identifier = request.identifier ?? `ordinary-${++counter}`;
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

    it('accepts conditional taps for the same home navigation path', async () => {
        const service = await load();
        const response = (type: string) => ({ notification: { request: { content: { data: { type } } } } });
        expect(service.isMoodReminderResponse(response('no-entry-reminder'))).toBe(true);
        expect(service.isMoodReminderResponse(response('mood-reminder'))).toBe(true);
        expect(service.isMoodReminderResponse(response('backup'))).toBe(false);
    });
});
