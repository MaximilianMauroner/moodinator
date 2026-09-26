import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), alert: vi.fn(), openSettings: vi.fn(), reconcile: vi.fn(), listen: vi.fn() }));
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable', Switch: 'Switch', ActivityIndicator: 'ActivityIndicator', Platform: { OS: 'ios' }, AppState: { addEventListener: mocks.listen }, Linking: { openSettings: mocks.openSettings } }));
vi.mock('expo-router', async () => { const React = await import('react'); return { useFocusEffect: (callback: () => (() => void)) => React.useEffect(callback, [callback]) }; });
vi.mock('@react-native-community/datetimepicker', () => ({ default: 'DateTimePicker' }));
vi.mock('expo-localization', () => ({ useLocales: () => [{ languageTag: 'en-GB' }], useCalendars: () => [{ uses24hourClock: true }] }));
vi.mock('@/constants/colors', () => ({ useThemeColors: () => ({ get: () => '#000' }) }));
vi.mock('@/components/ui/AppAlert', () => ({ Alert: { alert: mocks.alert } }));
vi.mock('@/services/notificationService', () => ({ getNoEntryReminderSettings: mocks.get, saveNoEntryReminderSettings: mocks.save, reconcileNoEntryReminder: mocks.reconcile }));
import { NoEntryReminderSettings } from '@/features/reminders/NoEntryReminderSettings';
const initial = { enabled: false, hour: 21, minute: 0, status: 'disabled', message: null, scheduledThroughDayKey: null, retainedIds: [] };
let renderer: ReactTestRenderer;
const control = (accessibilityLabel: string) => renderer.root.findByProps({ accessibilityLabel });
async function render() { await act(async () => { renderer = create(<NoEntryReminderSettings />); }); }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks();
  mocks.listen.mockReturnValue({ remove: vi.fn() }); mocks.reconcile.mockResolvedValue(initial);
  mocks.get.mockResolvedValue(initial); mocks.save.mockImplementation(async (value) => ({ ...initial, ...value }));
  mocks.openSettings.mockResolvedValue(undefined);
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); });
describe('optional no-entry reminder settings', () => {
  it('opens disabled at 21:00 with no save and canceling enable has no effect', async () => {
    await render(); expect(control('No entry today reminder').props.value).toBe(false);
    expect(control('Choose no-entry reminder time, currently 21:00')).toBeDefined();
    await act(async () => control('No entry today reminder').props.onValueChange(true));
    expect(mocks.alert).toHaveBeenCalledWith('Enable optional reminders?', expect.stringContaining('14 days'), expect.any(Array));
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('saves enabled only after confirmation and suppresses duplicate submissions', async () => {
    let resolve!: (value: unknown) => void;
    mocks.save.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await render(); await act(async () => control('No entry today reminder').props.onValueChange(true));
    const confirm = mocks.alert.mock.calls[0][2].find((action: { text: string }) => action.text === 'Enable').onPress;
    await act(async () => { confirm(); confirm(); });
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith({ enabled: true, hour: 21, minute: 0 });
    await act(async () => resolve({ ...initial, enabled: true, status: 'permission-denied', message: 'Permission denied' }));
    await act(async () => control('Open no-entry notification settings').props.onPress());
    expect(mocks.openSettings).toHaveBeenCalledOnce();
  });
  it('edits and saves time while remaining off', async () => {
    await render(); await act(async () => control('Choose no-entry reminder time, currently 21:00').props.onPress());
    await act(async () => renderer.root.findByType('DateTimePicker').props.onChange({ type: 'set' }, new Date(2026, 8, 26, 19, 15)));
    expect(mocks.save).not.toHaveBeenCalled();
    await act(async () => control('Save no-entry reminder time').props.onPress());
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith({ enabled: false, hour: 19, minute: 15 });
  });
  it('refreshes permission recovery status after returning from device settings', async () => {
    mocks.get.mockResolvedValue({ ...initial, enabled: true, status: 'permission-denied' });
    mocks.reconcile.mockResolvedValue({ ...initial, enabled: true, status: 'scheduled', scheduledThroughDayKey: '2026-10-09' });
    await render();
    const listener = mocks.listen.mock.calls[0][1];
    await act(async () => listener('active'));
    expect(mocks.reconcile).toHaveBeenCalledOnce();
    expect(renderer.root.findByProps({ accessibilityLiveRegion: 'polite' }).props.children).toContain('2026-10-09');
  });
  it('disables directly and keeps cleanup failures visible', async () => {
    mocks.get.mockResolvedValue({ ...initial, enabled: true, status: 'scheduled', scheduledThroughDayKey: '2026-10-09' });
    mocks.save.mockResolvedValue({ ...initial, status: 'failed', message: 'Some earlier reminders may still arrive.' });
    await render(); await act(async () => control('No entry today reminder').props.onValueChange(false));
    expect(mocks.alert).not.toHaveBeenCalled();
    expect(control('No entry today reminder').props.value).toBe(false);
    expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain('may still arrive');
  });
});
