import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCalendars } from 'expo-localization';
import { Platform } from 'react-native';
import type * as ExpoNotifications from 'expo-notifications';

const NOTIFICATIONS_ENABLED_KEY = 'notificationsEnabled';
const NOTIFICATION_TIME_KEY = 'notificationTime';
const NOTIFICATION_SCHEDULED_ID_KEY = 'moodReminderScheduledId';
const NOTIFICATIONS_LIST_KEY = 'notificationsList';
const NOTIFICATION_SCHEDULE_TIME_ZONE_KEY = 'notificationScheduleTimeZone';

const MOOD_REMINDER_TITLE = 'How are you feeling?';
const MOOD_REMINDER_BODY = "Don't forget to log your mood for today!";
const MOOD_REMINDER_TAG = 'mood-reminder';
const LEGACY_SINGLE_NOTIFICATION_ID = 'legacy-single';
const DEFAULT_NOTIFICATION_HOUR = 20;
const DEFAULT_NOTIFICATION_MINUTE = 0;

type NotificationsModule = typeof ExpoNotifications;
type NotificationListener = Parameters<NotificationsModule['addNotificationResponseReceivedListener']>[0];
export type NotificationResponse = Parameters<NotificationListener>[0];
type NotificationSubscription = { remove: () => void };
type NotificationAccessMode = 'request' | 'check-only';

let notificationsModule: NotificationsModule | null = null;
let notificationsModuleLoaded = false;
let notificationsModulePromise: Promise<NotificationsModule | null> | null = null;
let notificationHandlerConfigured = false;
let notificationsModuleUnavailableReason: string | null = null;
let mutationQueue: Promise<void> = Promise.resolve();

export type ReminderScheduleStatus =
    | 'scheduled'
    | 'disabled'
    | 'permission-denied'
    | 'unavailable'
    | 'failed'
    | 'partial-failure';

export type ReminderScheduleResult = {
    status: ReminderScheduleStatus;
    notifications: NotificationConfig[];
    failedIds?: string[];
    message?: string;
};

export interface NotificationConfig {
    id: string;
    title: string;
    body: string;
    hour: number;
    minute: number;
    enabled: boolean;
    scheduledId?: string;
    scheduleStatus?: Exclude<ReminderScheduleStatus, 'partial-failure'>;
    unscheduledReason?: string | null;
    pendingAction?: 'delete' | 'disable';
}

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation);
    mutationQueue = result.then(
        () => undefined,
        () => undefined
    );
    return result;
}

function configureNotificationHandler(Notifications: NotificationsModule): void {
    if (notificationHandlerConfigured) {
        return;
    }

    Notifications.setNotificationHandler({
        handleError(notificationId, error) {
            console.error(`[notifications] Error handling notification ${notificationId}:`, error);
        },
        handleNotification: async () => ({
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });

    notificationHandlerConfigured = true;
}

async function getNotificationsModule(): Promise<NotificationsModule | null> {
    if (notificationsModuleLoaded) {
        return notificationsModule;
    }

    if (!notificationsModulePromise) {
        notificationsModulePromise = import('expo-notifications')
            .then((module) => {
                notificationsModule = module;
                notificationsModuleLoaded = true;
                notificationsModuleUnavailableReason = null;
                configureNotificationHandler(module);
                return module;
            })
            .catch((error) => {
                notificationsModule = null;
                notificationsModuleLoaded = true;
                notificationsModuleUnavailableReason =
                    error instanceof Error
                        ? error.message
                        : 'Notifications module could not be loaded.';
                return null;
            })
            .finally(() => {
                notificationsModulePromise = null;
            });
    }

    return notificationsModulePromise;
}

type NotificationAccessResult =
    | { ok: true; notifications: NotificationsModule }
    | { ok: false; status: 'permission-denied' | 'unavailable' | 'failed'; message: string };

async function getNotificationAccess(mode: NotificationAccessMode): Promise<NotificationAccessResult> {
    const Notifications = await getNotificationsModule();
    if (!Notifications) {
        return {
            ok: false,
            status: 'unavailable',
            message: notificationsModuleUnavailableReason ?? 'Notifications are unavailable on this device.',
        };
    }

    try {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
            const channel = await Notifications.getNotificationChannelAsync('default');
            if (channel?.importance === Notifications.AndroidImportance.NONE) {
                return {
                    ok: false,
                    status: 'permission-denied',
                    message: 'The Moodinator notification channel is disabled in system settings.',
                };
            }
        }

        let permissions = await Notifications.getPermissionsAsync();
        const hasUsablePermission = () => {
            if (permissions.status === 'granted') {
                return true;
            }
            if (Platform.OS !== 'ios') {
                return false;
            }
            return permissions.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED
                || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
                || permissions.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL;
        };
        if (!hasUsablePermission() && mode === 'request') {
            permissions = await Notifications.requestPermissionsAsync();
        }
        if (!hasUsablePermission()) {
            return {
                ok: false,
                status: 'permission-denied',
                message: 'Notification permission was not granted.',
            };
        }
    } catch (error) {
        return {
            ok: false,
            status: 'failed',
            message: error instanceof Error ? error.message : 'Notification setup failed.',
        };
    }

    return { ok: true, notifications: Notifications };
}

function getCurrentTimeZone(): string {
    return getCalendars()[0]?.timeZone ?? 'unknown';
}

function getScheduledIdentifier(notification: unknown): string | null {
    if (typeof notification !== 'object' || notification === null || !('identifier' in notification)) {
        return null;
    }
    return typeof notification.identifier === 'string' ? notification.identifier : null;
}

function isMoodReminderNotification(notification: unknown): boolean {
    if (typeof notification !== 'object' || notification === null || !('content' in notification)) {
        return false;
    }
    const content = notification.content;
    if (typeof content !== 'object' || content === null) {
        return false;
    }
    const title = 'title' in content ? content.title : undefined;
    const data = 'data' in content ? content.data : undefined;
    const type = typeof data === 'object' && data !== null && 'type' in data
        ? data.type
        : undefined;
    return title === MOOD_REMINDER_TITLE || type === MOOD_REMINDER_TAG;
}

async function listScheduledMoodReminderIds(
    notifications: NotificationsModule
): Promise<string[]> {
    const scheduled = await notifications.getAllScheduledNotificationsAsync();
    return scheduled
        .filter(isMoodReminderNotification)
        .map(getScheduledIdentifier)
        .filter((identifier): identifier is string => identifier !== null);
}

async function cancelAllMoodRemindersUnlocked(
    Notifications: NotificationsModule,
    knownIds?: readonly string[]
): Promise<void> {
    const scheduledIds = knownIds ?? await listScheduledMoodReminderIds(Notifications);
    let firstError: unknown = null;
    let cancellationFailed = false;

    for (const identifier of scheduledIds) {
        try {
            await Notifications.cancelScheduledNotificationAsync(identifier);
        } catch (error) {
            cancellationFailed = true;
            firstError ??= error;
        }
    }

    if (cancellationFailed) {
        throw firstError ?? new Error('Moodinator could not cancel an existing reminder.');
    }
    await AsyncStorage.removeItem(NOTIFICATION_SCHEDULED_ID_KEY);
}

function createSingleReminderConfig(
    hour: number,
    minute: number,
    enabled: boolean,
    id = LEGACY_SINGLE_NOTIFICATION_ID
): NotificationConfig {
    return {
        id,
        title: MOOD_REMINDER_TITLE,
        body: MOOD_REMINDER_BODY,
        hour,
        minute,
        enabled,
    };
}

async function getLegacyNotificationSettings(): Promise<{
    exists: boolean;
    enabled: boolean;
    hour: number;
    minute: number;
    scheduledId: string | null;
}> {
    const enabled = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    const timeData = await AsyncStorage.getItem(NOTIFICATION_TIME_KEY);
    const scheduledId = await AsyncStorage.getItem(NOTIFICATION_SCHEDULED_ID_KEY);

    let hour = DEFAULT_NOTIFICATION_HOUR;
    let minute = DEFAULT_NOTIFICATION_MINUTE;

    if (timeData) {
        try {
            const parsed: unknown = JSON.parse(timeData);
            if (typeof parsed === 'object' && parsed !== null) {
                if ('hour' in parsed && typeof parsed.hour === 'number') {
                    hour = parsed.hour;
                }
                if ('minute' in parsed && typeof parsed.minute === 'number') {
                    minute = parsed.minute;
                }
            }
        } catch {
            // Ignore malformed legacy values and fall back to defaults.
        }
    }

    return {
        exists: enabled !== null || timeData !== null || scheduledId !== null,
        enabled: enabled !== 'false',
        hour,
        minute,
        scheduledId,
    };
}

function cloneNotification(notification: NotificationConfig): NotificationConfig {
    return {
        ...notification,
        unscheduledReason: notification.unscheduledReason ?? null,
    };
}

function materializeDesiredNotifications(
    notifications: NotificationConfig[]
): NotificationConfig[] {
    return notifications
        .filter((notification) => notification.pendingAction !== 'delete')
        .map((notification) => ({
            ...notification,
            enabled: notification.pendingAction === 'disable' ? false : notification.enabled,
            pendingAction: undefined,
        }));
}

function buildCleanupFailureNotifications(
    previousNotifications: NotificationConfig[],
    desiredNotifications: NotificationConfig[]
): NotificationConfig[] {
    const previousById = new Map(
        previousNotifications.map((notification) => [notification.id, notification])
    );
    const desiredIds = new Set(desiredNotifications.map((notification) => notification.id));
    const desiredWithCleanupState = desiredNotifications.map((desired) => {
        const previous = previousById.get(desired.id);
        const scheduledId = previous?.scheduledId ?? desired.scheduledId;
        const needsNativeDisable = !desired.enabled && Boolean(
            scheduledId
            || previous?.enabled
            || previous?.pendingAction === 'disable'
        );
        return {
            ...desired,
            scheduledId,
            pendingAction: needsNativeDisable ? 'disable' as const : undefined,
        };
    });
    const deleteTombstones = previousNotifications
        .filter((previous) => !desiredIds.has(previous.id))
        .map((previous) => ({
            ...previous,
            pendingAction: 'delete' as const,
        }));

    return [...desiredWithCleanupState, ...deleteTombstones];
}

function applyUnscheduledState(
    notification: NotificationConfig,
    status: Exclude<ReminderScheduleStatus, 'scheduled' | 'partial-failure'>,
    reason: string
): NotificationConfig {
    return {
        ...notification,
        scheduledId: undefined,
        scheduleStatus: status,
        unscheduledReason: reason,
    };
}

function applyScheduledState(
    notification: NotificationConfig,
    scheduledId: string
): NotificationConfig {
    return {
        ...notification,
        scheduledId,
        scheduleStatus: 'scheduled',
        unscheduledReason: null,
    };
}

async function persistNotifications(notifications: NotificationConfig[]): Promise<void> {
    await AsyncStorage.setItem(NOTIFICATIONS_LIST_KEY, JSON.stringify(notifications));
}

async function getAllNotificationsUnlocked(): Promise<NotificationConfig[]> {
    const stored = await AsyncStorage.getItem(NOTIFICATIONS_LIST_KEY);
    if (stored !== null) {
        try {
            const parsed: unknown = JSON.parse(stored);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('Failed to parse notifications:', error);
            return [];
        }
    }

    const oldSettings = await getLegacyNotificationSettings();
    if (oldSettings.exists && oldSettings.enabled) {
        const migrated = createSingleReminderConfig(
            oldSettings.hour,
            oldSettings.minute,
            true,
            'migrated-1'
        );
        const migratedWithState = oldSettings.scheduledId
            ? applyScheduledState(migrated, oldSettings.scheduledId)
            : applyUnscheduledState(migrated, 'failed', 'Reminder needs to be scheduled.');
        await persistNotifications([migratedWithState]);
        return [migratedWithState];
    }
    if (oldSettings.exists) {
        await persistNotifications([]);
    }
    return [];
}

function createCleanupFailedResult(
    notifications: NotificationConfig[],
    message: string
): ReminderScheduleResult {
    const failedNotifications = notifications.map((notification) =>
        ({
            ...cloneNotification(notification),
            scheduleStatus: 'failed' as const,
            unscheduledReason: message,
        })
    );
    return {
        status: 'failed',
        notifications: failedNotifications,
        failedIds: notifications.map((notification) => notification.id),
        message,
    };
}

async function persistCleanupFailedResult(
    notifications: NotificationConfig[],
    error: unknown,
    fallback: string
): Promise<ReminderScheduleResult> {
    const message = error instanceof Error ? error.message : fallback;
    const result = createCleanupFailedResult(notifications, message);
    await persistNotifications(result.notifications);
    return result;
}

async function rescheduleAllNotificationsUnlocked(
    notifications: NotificationConfig[],
    accessMode: NotificationAccessMode,
    prepared?: {
        access: Extract<NotificationAccessResult, { ok: true }>;
        scheduledIds: readonly string[];
    },
    cleanupFailureNotifications: NotificationConfig[] = notifications
): Promise<ReminderScheduleResult> {
    const nextNotifications = materializeDesiredNotifications(notifications).map(cloneNotification);
    const enabledNotifications = nextNotifications.filter((notification) => notification.enabled);
    let Notifications: NotificationsModule | null = prepared?.access.notifications ?? null;

    if (enabledNotifications.length > 0 && !prepared) {
        const access = await getNotificationAccess(accessMode);
        if (!access.ok) {
            const unscheduled = cleanupFailureNotifications.map((notification) =>
                notification.enabled || notification.pendingAction
                    ? {
                        ...cloneNotification(notification),
                        scheduleStatus: access.status,
                        unscheduledReason: access.message,
                    }
                    : applyUnscheduledState(notification, 'disabled', 'Reminder is disabled.')
            );
            await persistNotifications(unscheduled);
            return {
                status: access.status,
                notifications: unscheduled,
                failedIds: enabledNotifications.map((notification) => notification.id),
                message: access.message,
            };
        }
        Notifications = access.notifications;
    }

    Notifications ??= await getNotificationsModule();
    if (!Notifications) {
        return persistCleanupFailedResult(
            cleanupFailureNotifications,
            new Error(notificationsModuleUnavailableReason ?? 'Notifications are unavailable on this device.'),
            'Notifications are unavailable on this device.'
        );
    }

    try {
        await cancelAllMoodRemindersUnlocked(Notifications, prepared?.scheduledIds);
    } catch (error) {
        return persistCleanupFailedResult(
            cleanupFailureNotifications,
            error,
            'Moodinator could not safely replace the existing reminders.'
        );
    }

    const schedulingErrors: string[] = [];
    const scheduledNotifications: NotificationConfig[] = [];
    for (const notification of nextNotifications) {
        if (!notification.enabled) {
            scheduledNotifications.push(
                applyUnscheduledState(notification, 'disabled', 'Reminder is disabled.')
            );
            continue;
        }

        try {
            const id = await Notifications.scheduleNotificationAsync({
                content: {
                    title: notification.title,
                    body: notification.body,
                    data: { type: MOOD_REMINDER_TAG, notificationId: notification.id },
                },
                trigger: {
                    channelId: 'default',
                    hour: notification.hour,
                    minute: notification.minute,
                    type: Notifications.SchedulableTriggerInputTypes.DAILY,
                },
            });
            scheduledNotifications.push(applyScheduledState(notification, id));
        } catch (error) {
            console.error(`Failed to schedule notification ${notification.id}:`, error);
            schedulingErrors.push(notification.id);
            scheduledNotifications.push(
                applyUnscheduledState(
                    notification,
                    'failed',
                    error instanceof Error ? error.message : 'Failed to schedule reminder.'
                )
            );
        }
    }

    await persistNotifications(scheduledNotifications);

    if (schedulingErrors.length > 0) {
        const message = `Failed to schedule ${schedulingErrors.length} reminder${schedulingErrors.length === 1 ? '' : 's'}.`;
        return {
            status: schedulingErrors.length === enabledNotifications.length ? 'failed' : 'partial-failure',
            notifications: scheduledNotifications,
            failedIds: schedulingErrors,
            message,
        };
    }

    await AsyncStorage.setItem(NOTIFICATION_SCHEDULE_TIME_ZONE_KEY, getCurrentTimeZone());
    return {
        status: enabledNotifications.length > 0 ? 'scheduled' : 'disabled',
        notifications: scheduledNotifications,
    };
}

export function getAllNotifications(): Promise<NotificationConfig[]> {
    return enqueueMutation(getAllNotificationsUnlocked);
}

export function saveAllNotifications(
    notifications: NotificationConfig[]
): Promise<ReminderScheduleResult> {
    return enqueueMutation(async () => {
        const previousNotifications = await getAllNotificationsUnlocked();
        const desiredNotifications = materializeDesiredNotifications(notifications);
        return rescheduleAllNotificationsUnlocked(
            desiredNotifications,
            'request',
            undefined,
            buildCleanupFailureNotifications(previousNotifications, desiredNotifications)
        );
    });
}

export function cancelMoodReminder(): Promise<ReminderScheduleResult> {
    return enqueueMutation(async () => {
        const notifications = await getAllNotificationsUnlocked();
        const desiredNotifications = materializeDesiredNotifications(notifications).map(
            (notification) => ({ ...notification, enabled: false })
        );
        const result = await rescheduleAllNotificationsUnlocked(
            desiredNotifications,
            'request',
            undefined,
            buildCleanupFailureNotifications(notifications, desiredNotifications)
        );
        if (result.status === 'disabled') {
            await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'false');
        }
        return result;
    });
}

export function saveNotificationSettings(
    enabled: boolean,
    hour: number,
    minute: number
): Promise<ReminderScheduleStatus> {
    return enqueueMutation(async () => {
        await AsyncStorage.setItem(NOTIFICATION_TIME_KEY, JSON.stringify({ hour, minute }));
        const previousNotifications = await getAllNotificationsUnlocked();
        const nextNotifications = [createSingleReminderConfig(hour, minute, enabled)];
        const result = await rescheduleAllNotificationsUnlocked(
            nextNotifications,
            'request',
            undefined,
            buildCleanupFailureNotifications(previousNotifications, nextNotifications)
        );
        if (result.status === 'scheduled' || result.status === 'disabled') {
            await AsyncStorage.setItem(
                NOTIFICATIONS_ENABLED_KEY,
                String(enabled && result.status === 'scheduled')
            );
        }
        return result.status;
    });
}

export function getNotificationSettings(): Promise<{ enabled: boolean; hour: number; minute: number }> {
    return enqueueMutation(async () => {
        const storedNotifications = await AsyncStorage.getItem(NOTIFICATIONS_LIST_KEY);
        if (storedNotifications !== null) {
            const notifications = await getAllNotificationsUnlocked();
            const notification = notifications.find((item) => item.enabled) ?? notifications[0];
            return notification
                ? { enabled: notification.enabled, hour: notification.hour, minute: notification.minute }
                : { enabled: false, hour: DEFAULT_NOTIFICATION_HOUR, minute: DEFAULT_NOTIFICATION_MINUTE };
        }

        const legacySettings = await getLegacyNotificationSettings();
        return legacySettings.exists
            ? { enabled: legacySettings.enabled, hour: legacySettings.hour, minute: legacySettings.minute }
            : { enabled: false, hour: DEFAULT_NOTIFICATION_HOUR, minute: DEFAULT_NOTIFICATION_MINUTE };
    });
}

export function addNotification(
    notification: Omit<
        NotificationConfig,
        'id' | 'scheduledId' | 'scheduleStatus' | 'unscheduledReason' | 'pendingAction'
    >
): Promise<NotificationConfig> {
    return enqueueMutation(async () => {
        const notifications = await getAllNotificationsUnlocked();
        const desiredNotifications = materializeDesiredNotifications(notifications);
        const newNotification: NotificationConfig = {
            ...notification,
            id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        };
        const nextNotifications = [...desiredNotifications, newNotification];
        const result = await rescheduleAllNotificationsUnlocked(
            nextNotifications,
            'request',
            undefined,
            buildCleanupFailureNotifications(notifications, nextNotifications)
        );
        return result.notifications.find((item) => item.id === newNotification.id)
            ?? applyUnscheduledState(
                newNotification,
                'failed',
                result.message ?? 'Moodinator could not save this reminder.'
            );
    });
}

export function updateNotification(
    id: string,
    updates: Partial<Omit<NotificationConfig, 'id' | 'pendingAction'>>
): Promise<ReminderScheduleResult> {
    return enqueueMutation(async () => {
        const previousNotifications = await getAllNotificationsUnlocked();
        const notifications = materializeDesiredNotifications(previousNotifications);
        const index = notifications.findIndex((notification) => notification.id === id);
        if (index === -1) {
            throw new Error(`Notification with id ${id} not found`);
        }
        notifications[index] = { ...notifications[index], ...updates };
        return rescheduleAllNotificationsUnlocked(
            notifications,
            'request',
            undefined,
            buildCleanupFailureNotifications(previousNotifications, notifications)
        );
    });
}

export function deleteNotification(id: string): Promise<ReminderScheduleResult> {
    return enqueueMutation(async () => {
        const previousNotifications = await getAllNotificationsUnlocked();
        const notifications = materializeDesiredNotifications(previousNotifications);
        const desiredNotifications = notifications.filter((notification) => notification.id !== id);
        return rescheduleAllNotificationsUnlocked(
            desiredNotifications,
            'request',
            undefined,
            buildCleanupFailureNotifications(previousNotifications, desiredNotifications)
        );
    });
}

export function ensureMoodReminderScheduled(): Promise<ReminderScheduleResult | null> {
    return enqueueMutation(async () => {
        const notifications = await getAllNotificationsUnlocked();
        const hasPendingActions = notifications.some((notification) => notification.pendingAction);
        if (hasPendingActions) {
            const resolvedNotifications = materializeDesiredNotifications(notifications);
            return rescheduleAllNotificationsUnlocked(
                resolvedNotifications,
                'check-only',
                undefined,
                buildCleanupFailureNotifications(notifications, resolvedNotifications)
            );
        }
        const enabledNotifications = notifications.filter((notification) => notification.enabled);

        if (enabledNotifications.length === 0) {
            const needsCleanup = notifications.some(
                (notification) => notification.scheduledId || notification.scheduleStatus !== 'disabled'
            );
            return needsCleanup
                ? rescheduleAllNotificationsUnlocked(notifications, 'check-only')
                : null;
        }

        const access = await getNotificationAccess('check-only');
        if (!access.ok) {
            const unscheduled = notifications.map((notification) =>
                notification.enabled
                    ? applyUnscheduledState(notification, access.status, access.message)
                    : applyUnscheduledState(notification, 'disabled', 'Reminder is disabled.')
            );
            await persistNotifications(unscheduled);
            return {
                status: access.status,
                notifications: unscheduled,
                failedIds: enabledNotifications.map((notification) => notification.id),
                message: access.message,
            };
        }

        let scheduledIds: string[];
        try {
            scheduledIds = await listScheduledMoodReminderIds(access.notifications);
        } catch (error) {
            return persistCleanupFailedResult(
                notifications,
                error,
                'Moodinator could not verify the existing reminders.'
            );
        }

        const currentTimeZone = getCurrentTimeZone();
        const scheduledTimeZone = await AsyncStorage.getItem(NOTIFICATION_SCHEDULE_TIME_ZONE_KEY);
        const expectedIds = enabledNotifications
            .map((notification) => notification.scheduledId)
            .filter((identifier): identifier is string => typeof identifier === 'string');
        const scheduledIdSet = new Set(scheduledIds);
        const allEnabledScheduled =
            expectedIds.length === enabledNotifications.length
            && expectedIds.every((identifier) => scheduledIdSet.has(identifier))
            && enabledNotifications.every(
                (notification) => notification.scheduleStatus === 'scheduled'
            );
        const noStrayMoodReminders = scheduledIds.length === expectedIds.length;

        if (
            allEnabledScheduled
            && noStrayMoodReminders
            && scheduledTimeZone === currentTimeZone
        ) {
            return null;
        }

        return rescheduleAllNotificationsUnlocked(notifications, 'check-only', {
            access,
            scheduledIds,
        }, notifications);
    });
}

export async function addNotificationResponseReceivedListener(
    listener: NotificationListener
): Promise<NotificationSubscription | null> {
    const Notifications = await getNotificationsModule();
    if (!Notifications) {
        return null;
    }
    return Notifications.addNotificationResponseReceivedListener(listener);
}

export async function getLastNotificationResponse(): Promise<NotificationResponse | null> {
    const Notifications = await getNotificationsModule();
    return Notifications ? Notifications.getLastNotificationResponseAsync() : null;
}

export async function clearLastNotificationResponse(): Promise<void> {
    const Notifications = await getNotificationsModule();
    if (Notifications) {
        await Notifications.clearLastNotificationResponseAsync();
    }
}

export function isMoodReminderResponse(response: unknown): response is NotificationResponse {
    if (typeof response !== 'object' || response === null || !('notification' in response)) {
        return false;
    }
    const notification = response.notification;
    if (typeof notification !== 'object' || notification === null || !('request' in notification)) {
        return false;
    }
    const request = notification.request;
    if (typeof request !== 'object' || request === null || !('content' in request)) {
        return false;
    }
    const content = request.content;
    if (typeof content !== 'object' || content === null || !('data' in content)) {
        return false;
    }
    const data = content.data;
    return typeof data === 'object' && data !== null && 'type' in data && data.type === MOOD_REMINDER_TAG;
}

export function getNotificationResponseIdentity(response: NotificationResponse): string {
    return [
        response.notification.request.identifier,
        response.notification.date,
        response.actionIdentifier,
    ].join(':');
}

export function cancelAllScheduledNotifications(): Promise<void> {
    return enqueueMutation(async () => {
        const Notifications = await getNotificationsModule();
        if (Notifications) {
            await Notifications.cancelAllScheduledNotificationsAsync();
        }
    });
}

export function scheduleTestNotification(): Promise<boolean> {
    return enqueueMutation(async () => {
        const access = await getNotificationAccess('request');
        if (!access.ok) {
            return false;
        }
        try {
            await access.notifications.scheduleNotificationAsync({
                content: { title: 'Test Notification', body: 'This is a test notification!' },
                trigger: {
                    type: access.notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                    seconds: 2,
                },
            });
            return true;
        } catch {
            return false;
        }
    });
}

export const notificationService = {
    addNotification,
    addNotificationResponseReceivedListener,
    cancelAllScheduledNotifications,
    cancelMoodReminder,
    clearLastNotificationResponse,
    deleteNotification,
    ensureMoodReminderScheduled,
    getAllNotifications,
    getLastNotificationResponse,
    getNotificationSettings,
    saveAllNotifications,
    saveNotificationSettings,
    scheduleTestNotification,
    updateNotification,
};
