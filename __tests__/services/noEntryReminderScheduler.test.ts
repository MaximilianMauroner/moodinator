import { describe, expect, it, vi } from 'vitest';
import {
    createNoEntryReminderScheduler,
    NO_ENTRY_REMINDER_SETTINGS_KEY,
    NO_ENTRY_REMINDER_TAG,
    type NoEntryReminderDependencies,
} from '../../src/services/noEntryReminderScheduler';

type NativeRequest = { identifier: string; content: { data?: Record<string, unknown>; title?: string }; trigger?: unknown };
function harness() {
    const stored = new Map<string, string>();
    const requests = new Map<string, NativeRequest>();
    const state = { now: new Date(2026, 8, 26, 10), entries: [] as number[], timeZone: 'Etc/UTC', ordinary: [] as { hour: number; minute: number; enabled: boolean; scheduleStatus: string; scheduledId?: string; scheduledIds?: string[]; weekdays?: number[] }[] };
    const storage = {
        getItem: vi.fn(async (key: string) => stored.get(key) ?? null),
        setItem: vi.fn(async (key: string, value: string) => { stored.set(key, value); }),
    };
    const native = {
        SchedulableTriggerInputTypes: { DATE: 'date' },
        getAllScheduledNotificationsAsync: vi.fn(async () => [...requests.values()]),
        cancelScheduledNotificationAsync: vi.fn(async (id: string) => { requests.delete(id); }),
        scheduleNotificationAsync: vi.fn(async (request: NativeRequest) => { requests.set(request.identifier, request); return request.identifier; }),
    };
    const deps = {
        storage,
        getAccess: vi.fn(async () => ({ ok: true as const, notifications: native })),
        getModule: vi.fn(async () => native),
        getOrdinaryReminders: vi.fn(async () => state.ordinary),
        getEntryTimestamps: vi.fn(async (start: Date, end: Date) => state.entries.filter((timestamp) => timestamp >= +start && timestamp < +end)),
        now: () => state.now,
        getTimeZone: () => state.timeZone,
    };
    const create = () => createNoEntryReminderScheduler(deps as unknown as NoEntryReminderDependencies);
    return { stored, requests, storage, native, deps, state, create, scheduler: create() };
}
const enabled = { enabled: true, hour: 21, minute: 0 };

describe('no-entry reminder scheduler', () => {
    it('defaults off with a read-only settings API and inert reconciliation', async () => {
        const h = harness();
        expect(await h.scheduler.getSettings()).toMatchObject({ enabled: false, hour: 21, minute: 0, status: 'disabled' });
        await h.scheduler.reconcile();
        expect(h.storage.setItem).not.toHaveBeenCalled();
        expect(h.deps.getAccess).not.toHaveBeenCalled();
        expect(h.deps.getModule).not.toHaveBeenCalled();
    });

    it('persists explicit intent before requesting permission and uses one-shot native dates', async () => {
        const h = harness();
        h.deps.getAccess.mockImplementation(async () => {
            expect(JSON.parse(h.stored.get(NO_ENTRY_REMINDER_SETTINGS_KEY)!)).toMatchObject(enabled);
            return { ok: true, notifications: h.native };
        });
        const result = await h.scheduler.save(enabled);
        expect(result).toMatchObject({ status: 'scheduled', scheduledThroughDayKey: '2026-10-09' });
        expect(result.retainedIds).toHaveLength(14);
        expect(h.deps.getAccess).toHaveBeenCalledWith('request');
        expect(h.requests.get('no-entry-2026-09-26')).toMatchObject({
            content: { data: { type: NO_ENTRY_REMINDER_TAG, dayKey: '2026-09-26', timeZone: 'Etc/UTC' } },
            trigger: { type: 'date', date: new Date(2026, 8, 26, 21) },
        });
    });

    it('keeps enabled intent after denial and never prompts during background reconciliation', async () => {
        const h = harness();
        h.deps.getAccess.mockResolvedValue({ ok: false, status: 'permission-denied', message: 'Denied' } as never);
        expect(await h.scheduler.save(enabled)).toMatchObject({ enabled: true, status: 'permission-denied' });
        await h.scheduler.reconcile();
        expect(h.deps.getAccess).toHaveBeenLastCalledWith('check-only');
        expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('cancels today after a save and restores it after the last entry is deleted', async () => {
        const h = harness();
        await h.scheduler.save(enabled);
        h.native.scheduleNotificationAsync.mockClear();
        h.state.entries = [new Date(2026, 8, 26, 11).getTime()];
        await h.scheduler.reconcile();
        expect(h.requests.has('no-entry-2026-09-26')).toBe(false);
        expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
        h.state.entries = [];
        await h.scheduler.reconcile();
        expect(h.requests.has('no-entry-2026-09-26')).toBe(true);
        expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    });

    it('does not reschedule unchanged native requests across a restart', async () => {
        const h = harness();
        await h.scheduler.save(enabled);
        h.native.scheduleNotificationAsync.mockClear();
        h.native.cancelScheduledNotificationAsync.mockClear();
        await h.create().reconcile();
        expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
        expect(h.native.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });

    it('keeps failed cancellations visible across restart and retries disabled cleanup without permission', async () => {
        const h = harness();
        await h.scheduler.save(enabled);
        h.deps.getAccess.mockClear();
        h.native.cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error('busy'));
        const failed = await h.scheduler.save({ ...enabled, enabled: false });
        expect(failed).toMatchObject({ enabled: false, status: 'failed', scheduledThroughDayKey: null });
        expect(failed.message).toContain('may still arrive');
        expect(failed.retainedIds).toEqual(['no-entry-2026-09-26']);
        expect(h.deps.getAccess).not.toHaveBeenCalled();
        expect(await h.create().reconcile()).toMatchObject({ enabled: false, status: 'disabled', retainedIds: [] });
        expect(h.requests.size).toBe(0);
    });

    it('does not schedule replacements if changing the time cannot safely cancel old requests', async () => {
        const h = harness();
        await h.scheduler.save(enabled);
        h.native.scheduleNotificationAsync.mockClear();
        h.native.cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error('busy'));
        expect(await h.scheduler.save({ ...enabled, hour: 22 })).toMatchObject({ hour: 22, status: 'failed' });
        expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
        expect(await h.create().reconcile()).toMatchObject({ hour: 22, status: 'scheduled' });
        expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(14);
        expect(h.requests.get('no-entry-2026-09-26')?.content.data?.fireAt).toBe(+new Date(2026, 8, 26, 22));
    });

    it('does not backfill today when an entry read crosses the selected time', async () => {
        const h = harness();
        h.state.now = new Date(2026, 8, 26, 20, 59);
        h.deps.getEntryTimestamps.mockImplementationOnce(async () => {
            h.state.now = new Date(2026, 8, 26, 21);
            return [];
        });
        const result = await h.scheduler.save(enabled);
        expect(h.requests.has('no-entry-2026-09-26')).toBe(false);
        expect(result.retainedIds).not.toContain('no-entry-2026-09-26');
        expect(h.requests.size).toBe(13);
    });

    it('does not backfill today when native cancellation crosses an edited time', async () => {
        const h = harness();
        await h.scheduler.save({ ...enabled, hour: 22 });
        h.state.now = new Date(2026, 8, 26, 20, 59);
        h.native.cancelScheduledNotificationAsync.mockImplementationOnce(async (id) => {
            h.requests.delete(id);
            h.state.now = new Date(2026, 8, 26, 21);
        });
        const result = await h.scheduler.save(enabled);
        expect(h.requests.has('no-entry-2026-09-26')).toBe(false);
        expect(result.retainedIds).not.toContain('no-entry-2026-09-26');
        expect(h.requests.size).toBe(13);
    });

    it('reports a shorter capacity-limited horizon and preserves other notifications', async () => {
        const h = harness();
        for (let index = 0; index < 62; index++) h.requests.set(`other-${index}`, { identifier: `other-${index}`, content: {} });
        const result = await h.scheduler.save(enabled);
        expect(result).toMatchObject({ status: 'limited', scheduledThroughDayKey: null });
        expect(result.retainedIds).toHaveLength(2);
        expect(h.requests.size).toBe(64);
        expect(h.native.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });

    it('suppresses collisions only for ordinary reminders actually present in the OS', async () => {
        const h = harness();
        h.state.ordinary = [{ ...enabled, scheduleStatus: 'scheduled', scheduledId: 'ordinary' }];
        await h.scheduler.save(enabled);
        expect(h.requests.size).toBe(14);
        h.requests.set('ordinary', { identifier: 'ordinary', content: {} });
        const result = await h.scheduler.reconcile();
        expect(result.retainedIds).toEqual([]);
        expect(h.requests.size).toBe(1);
    });

    it('suppresses only weekly dates whose corresponding native request survives', async () => {
        const h = harness();
        // September 26 is Saturday; IDs use normalized weekday order: Sunday, Saturday.
        h.state.ordinary = [{ ...enabled, weekdays: [7, 1], scheduleStatus: 'scheduled', scheduledIds: ['sunday', 'saturday'] }];
        h.requests.set('saturday', { identifier: 'saturday', content: {} });
        await h.scheduler.save(enabled);
        expect(h.requests.has('no-entry-2026-09-26')).toBe(false);
        expect(h.requests.has('no-entry-2026-09-27')).toBe(true);
        h.requests.set('sunday', { identifier: 'sunday', content: {} });
        await h.scheduler.reconcile();
        expect(h.requests.has('no-entry-2026-09-26')).toBe(false);
        expect(h.requests.has('no-entry-2026-09-27')).toBe(false);
        expect(h.requests.has('no-entry-2026-09-28')).toBe(true);
    });

    it('does not trust incomplete or duplicate persisted weekly request IDs', async () => {
        const h = harness();
        h.state.ordinary = [{ ...enabled, weekdays: [7, 1], scheduleStatus: 'scheduled', scheduledIds: ['saturday'] }];
        h.requests.set('saturday', { identifier: 'saturday', content: {} });
        await h.scheduler.save(enabled);
        expect(h.requests.has('no-entry-2026-09-26')).toBe(true);
        h.state.ordinary[0].scheduledIds = ['saturday', 'saturday'];
        await h.scheduler.reconcile();
        expect(h.requests.has('no-entry-2026-09-26')).toBe(true);
    });

    it('records partial native failures and retries stable IDs without duplicating successful requests', async () => {
        const h = harness();
        h.native.scheduleNotificationAsync.mockImplementationOnce(async (request) => {
            h.requests.set(request.identifier, request);
            return request.identifier;
        }).mockRejectedValueOnce(new Error('OS capacity changed'));
        const result = await h.scheduler.save(enabled);
        expect(result.status).toBe('failed');
        expect(result.scheduledThroughDayKey).toBeNull();
        expect(result.retainedIds).toHaveLength(2);
        expect(await h.create().reconcile()).toMatchObject({ status: 'scheduled' });
        expect(h.requests.size).toBe(14);
        expect(h.native.scheduleNotificationAsync.mock.calls.filter(([request]) => request.identifier === 'no-entry-2026-09-26')).toHaveLength(1);
    });

    it('recovers native requests after final persistence failed', async () => {
        const h = harness();
        h.storage.setItem.mockImplementationOnce(async (key, value) => { h.stored.set(key, value); })
            .mockRejectedValueOnce(new Error('disk full'));
        await expect(h.scheduler.save(enabled)).rejects.toThrow('disk full');
        expect(h.requests.size).toBe(14);
        h.native.scheduleNotificationAsync.mockClear();
        expect(await h.create().reconcile()).toMatchObject({ status: 'scheduled' });
        expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('reports DB/native enumeration failures without claiming an upcoming horizon', async () => {
        const h = harness();
        h.deps.getEntryTimestamps.mockRejectedValueOnce(new Error('DB unavailable'));
        expect(await h.scheduler.save(enabled)).toMatchObject({ status: 'failed', scheduledThroughDayKey: null, message: 'DB unavailable' });
        h.native.getAllScheduledNotificationsAsync.mockRejectedValueOnce(new Error('OS unavailable'));
        expect(await h.scheduler.reconcile()).toMatchObject({ status: 'failed', scheduledThroughDayKey: null, message: 'OS unavailable' });
    });

    it('suppresses foreground delivery after an entry or preference change', async () => {
        const h = harness();
        await h.scheduler.save(enabled);
        const data = h.requests.get('no-entry-2026-09-26')!.content.data!;
        expect(await h.scheduler.shouldPresent(data)).toBe(true);
        h.state.entries = [+new Date(2026, 8, 26, 12)];
        expect(await h.scheduler.shouldPresent(data)).toBe(false);
        h.state.entries = [];
        await h.scheduler.save({ ...enabled, hour: 22 });
        expect(await h.scheduler.shouldPresent(data)).toBe(false);
        expect(await h.scheduler.shouldPresent({ type: 'mood-reminder' })).toBe(true);
    });
});
