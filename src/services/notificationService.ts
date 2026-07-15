import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { AppOwnership, ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type * as ExpoNotifications from 'expo-notifications';

const NOTIFICATIONS_ENABLED_KEY = 'notificationsEnabled';
const NOTIFICATION_TIME_KEY = 'notificationTime';
const NOTIFICATION_SCHEDULED_ID_KEY = 'moodReminderScheduledId';
const NOTIFICATIONS_LIST_KEY = 'notificationsList';

// Constants to identify our app's reminder notifications
const MOOD_REMINDER_TITLE = 'How are you feeling?';
const MOOD_REMINDER_BODY = "Don't forget to log your mood for today!";
const MOOD_REMINDER_TAG = 'mood-reminder';
const LEGACY_SINGLE_NOTIFICATION_ID = 'legacy-single';
const DEFAULT_NOTIFICATION_HOUR = 20;
const DEFAULT_NOTIFICATION_MINUTE = 0;

type NotificationsModule = typeof ExpoNotifications;
type NotificationListener = Parameters<NotificationsModule['addNotificationResponseReceivedListener']>[0];
type NotificationSubscription = { remove: () => void };

let notificationsModule: NotificationsModule | null = null;
let notificationsModuleLoaded = false;
let notificationsModulePromise: Promise<NotificationsModule | null> | null = null;
let notificationHandlerConfigured = false;
let notificationsModuleUnavailableReason: string | null = null;

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
}

function isAndroidExpoGo(): boolean {
    if (
        Platform.OS !== 'android'
        || Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
    ) {
        return false;
    }

    if (Constants.appOwnership === AppOwnership.Expo) {
        return true;
    }

    try {
        return Constants.expoGoConfig !== null;
    } catch {
        return false;
    }
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
            shouldShowList: true
        }),
    });

    notificationHandlerConfigured = true;
}

async function getNotificationsModule(): Promise<NotificationsModule | null> {
    if (isAndroidExpoGo()) {
        notificationsModuleUnavailableReason = 'Notifications are unavailable in Android Expo Go.';
        return null;
    }

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

async function getNotificationAccess(): Promise<NotificationAccessResult> {
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
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
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

function getScheduledIdentifier(notification: unknown): string | null {
    const candidate = notification as { identifier?: unknown };
    return typeof candidate?.identifier === 'string' ? candidate.identifier : null;
}

function isMoodReminderNotification(notification: unknown): boolean {
    const candidate = notification as {
        content?: {
            title?: unknown;
            data?: { type?: unknown };
        };
    };
    return (
        candidate?.content?.title === MOOD_REMINDER_TITLE ||
        candidate?.content?.data?.type === MOOD_REMINDER_TAG
    );
}

async function getScheduledMoodReminderIds(
    notifications: NotificationsModule
): Promise<Set<string>> {
    try {
        const scheduled = await notifications.getAllScheduledNotificationsAsync();
        return new Set(
            scheduled
                .filter(isMoodReminderNotification)
                .map(getScheduledIdentifier)
                .filter((identifier): identifier is string => identifier !== null)
        );
    } catch {
        return new Set();
    }
}

// Helper to cancel any stray mood reminder notifications (from older versions)
async function cancelAllMoodReminders(notifications?: NotificationsModule | null) {
    const Notifications = notifications ?? await getNotificationsModule();
    if (!Notifications) {
        return;
    }

    try {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        for (const n of scheduled) {
            const identifier = getScheduledIdentifier(n);
            if (identifier && isMoodReminderNotification(n)) {
                try {
                    await Notifications.cancelScheduledNotificationAsync(identifier);
                } catch { }
            }
        }
    } catch { }
    await AsyncStorage.removeItem(NOTIFICATION_SCHEDULED_ID_KEY);
}

export async function cancelMoodReminder() {
    const storedNotifications = await AsyncStorage.getItem(NOTIFICATIONS_LIST_KEY);
    if (storedNotifications !== null) {
        const notifications = await getAllNotifications();
        await saveAllNotifications(
            notifications.map((notification) => ({
                ...notification,
                enabled: false,
            }))
        );
        await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'false');
        return;
    }

    await cancelAllMoodReminders();
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'false');
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

// Helper functions for managing notification settings
export async function saveNotificationSettings(
    enabled: boolean,
    hour: number,
    minute: number
): Promise<ReminderScheduleStatus> {
    await AsyncStorage.setItem(NOTIFICATION_TIME_KEY, JSON.stringify({ hour, minute }));
    const result = await saveAllNotifications([
        createSingleReminderConfig(hour, minute, enabled),
    ]);

    await AsyncStorage.setItem(
        NOTIFICATIONS_ENABLED_KEY,
        String(enabled && result.status === 'scheduled')
    );
    return result.status;
}

export async function getNotificationSettings(): Promise<{ enabled: boolean; hour: number; minute: number }> {
    const storedNotifications = await AsyncStorage.getItem(NOTIFICATIONS_LIST_KEY);
    if (storedNotifications !== null) {
        const notifications = await getAllNotifications();
        const notification = notifications.find((item) => item.enabled) ?? notifications[0];
        if (notification) {
            return {
                enabled: notification.enabled,
                hour: notification.hour,
                minute: notification.minute,
            };
        }
        return {
            enabled: false,
            hour: DEFAULT_NOTIFICATION_HOUR,
            minute: DEFAULT_NOTIFICATION_MINUTE,
        };
    }

    const legacySettings = await getLegacyNotificationSettings();
    if (legacySettings.exists) {
        return {
            enabled: legacySettings.enabled,
            hour: legacySettings.hour,
            minute: legacySettings.minute,
        };
    }
    return {
        enabled: false,
        hour: DEFAULT_NOTIFICATION_HOUR,
        minute: DEFAULT_NOTIFICATION_MINUTE,
    };
}

async function getLegacyNotificationSettings(): Promise<{
    exists: boolean;
    enabled: boolean;
    hour: number;
    minute: number;
}> {
    const enabled = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    const timeData = await AsyncStorage.getItem(NOTIFICATION_TIME_KEY);
    const scheduledId = await AsyncStorage.getItem(NOTIFICATION_SCHEDULED_ID_KEY);

    let hour = DEFAULT_NOTIFICATION_HOUR;
    let minute = DEFAULT_NOTIFICATION_MINUTE;

    if (timeData) {
        try {
            const parsed = JSON.parse(timeData);
            if (typeof parsed?.hour === "number") {
                hour = parsed.hour;
            }
            if (typeof parsed?.minute === "number") {
                minute = parsed.minute;
            }
        } catch {
            // Ignore malformed legacy values and fall back to defaults.
        }
    }

    return {
        exists: enabled !== null || timeData !== null || scheduledId !== null,
        enabled: enabled !== "false",
        hour,
        minute,
    };
}

function cloneNotification(notification: NotificationConfig): NotificationConfig {
    return {
        ...notification,
        unscheduledReason: notification.unscheduledReason ?? null,
    };
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

async function persistNotifications(
    notifications: NotificationConfig[]
): Promise<void> {
    await AsyncStorage.setItem(NOTIFICATIONS_LIST_KEY, JSON.stringify(notifications));
}

// New functions for managing multiple notifications
export async function getAllNotifications(): Promise<NotificationConfig[]> {
    try {
        const stored = await AsyncStorage.getItem(NOTIFICATIONS_LIST_KEY);
        if (stored !== null) {
            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) ? parsed : [];
        }
        // Migrate from old single notification if it exists
        const oldSettings = await getLegacyNotificationSettings();
        if (oldSettings.exists && oldSettings.enabled) {
            const migrated = createSingleReminderConfig(
                oldSettings.hour,
                oldSettings.minute,
                true,
                'migrated-1'
            );
            const result = await saveAllNotifications([migrated]);
            return result.notifications;
        }
        if (oldSettings.exists) {
            await persistNotifications([]);
        }
        return [];
    } catch (error) {
        console.error('Failed to get notifications:', error);
        return [];
    }
}

export async function saveAllNotifications(
    notifications: NotificationConfig[]
): Promise<ReminderScheduleResult> {
    try {
        return await rescheduleAllNotifications(notifications);
    } catch (error) {
        console.error('Failed to save notifications:', error);
        throw error;
    }
}

async function rescheduleAllNotifications(
    notifications: NotificationConfig[]
): Promise<ReminderScheduleResult> {
    const nextNotifications = notifications.map(cloneNotification);
    const enabledNotifications = nextNotifications.filter((notification) => notification.enabled);
    const access = enabledNotifications.length > 0
        ? await getNotificationAccess()
        : null;

    if (access && !access.ok) {
        await cancelAllMoodReminders(await getNotificationsModule());
        const unscheduled = nextNotifications.map((notification) =>
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

    const Notifications = access?.notifications ?? await getNotificationsModule();

    await cancelAllMoodReminders(Notifications);

    // Schedule all enabled notifications
    const schedulingErrors: string[] = [];
    const scheduledNotifications: NotificationConfig[] = [];
    for (const notification of nextNotifications) {
        const index = scheduledNotifications.length;
        if (notification.enabled) {
            try {
                if (!Notifications) {
                    throw new Error('Notifications are unavailable on this device.');
                }
                const id = await Notifications.scheduleNotificationAsync({
                    content: {
                        title: notification.title,
                        body: notification.body,
                        data: { type: MOOD_REMINDER_TAG, notificationId: notification.id },
                    },
                    trigger: {
                        channelId: "default",
                        hour: notification.hour,
                        minute: notification.minute,
                        type: Notifications.SchedulableTriggerInputTypes.DAILY
                    },
                });
                scheduledNotifications[index] = applyScheduledState(notification, id);
            } catch (error) {
                console.error(`Failed to schedule notification ${notification.id}:`, error);
                schedulingErrors.push(notification.id);
                scheduledNotifications[index] = applyUnscheduledState(
                    notification,
                    'failed',
                    error instanceof Error ? error.message : 'Failed to schedule reminder.'
                );
            }
        } else {
            scheduledNotifications[index] = applyUnscheduledState(
                notification,
                'disabled',
                'Reminder is disabled.'
            );
        }
    }

    await persistNotifications(scheduledNotifications);

    if (schedulingErrors.length > 0) {
        const message = `Failed to schedule ${schedulingErrors.length} reminder${schedulingErrors.length === 1 ? "" : "s"}.`;
        return {
            status: schedulingErrors.length === enabledNotifications.length ? 'failed' : 'partial-failure',
            notifications: scheduledNotifications,
            failedIds: schedulingErrors,
            message,
        };
    }

    return {
        status: enabledNotifications.length > 0 ? 'scheduled' : 'disabled',
        notifications: scheduledNotifications,
    };
}

export async function addNotification(
    notification: Omit<NotificationConfig, 'id' | 'scheduledId' | 'scheduleStatus' | 'unscheduledReason'>
): Promise<NotificationConfig> {
    const notifications = await getAllNotifications();
    const newNotification: NotificationConfig = {
        ...notification,
        id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    const result = await saveAllNotifications([...notifications, newNotification]);
    return result.notifications.find((item) => item.id === newNotification.id) ?? newNotification;
}

export async function updateNotification(
    id: string,
    updates: Partial<Omit<NotificationConfig, 'id'>>
): Promise<ReminderScheduleResult> {
    const notifications = await getAllNotifications();
    const index = notifications.findIndex(n => n.id === id);
    if (index === -1) {
        throw new Error(`Notification with id ${id} not found`);
    }
    notifications[index] = { ...notifications[index], ...updates };
    return saveAllNotifications(notifications);
}

export async function deleteNotification(id: string): Promise<ReminderScheduleResult> {
    const notifications = await getAllNotifications();
    const notification = notifications.find(n => n.id === id);
    if (notification?.scheduledId) {
        const Notifications = await getNotificationsModule();
        if (Notifications) {
            try {
                await Notifications.cancelScheduledNotificationAsync(notification.scheduledId);
            } catch (error) {
                console.error(`Failed to cancel notification ${id}:`, error);
            }
        }
    }
    const filtered = notifications.filter(n => n.id !== id);
    return saveAllNotifications(filtered);
}


export async function ensureMoodReminderScheduled(): Promise<ReminderScheduleResult | null> {
    const notifications = await getAllNotifications();
    const enabledNotifications = notifications.filter((notification) => notification.enabled);
    if (enabledNotifications.length === 0) {
        return saveAllNotifications(notifications);
    }

    const Notifications = await getNotificationsModule();
    if (!Notifications) {
        return saveAllNotifications(notifications);
    }

    const scheduledIds = await getScheduledMoodReminderIds(Notifications);
    const allEnabledScheduled = enabledNotifications.every(
        (notification) =>
            typeof notification.scheduledId === 'string' &&
            scheduledIds.has(notification.scheduledId)
    );

    if (!allEnabledScheduled) {
        return saveAllNotifications(notifications);
    }

    return null;
}

export async function addNotificationResponseReceivedListener(
    listener: NotificationListener
): Promise<NotificationSubscription | null> {
    const Notifications = await getNotificationsModule();
    if (!Notifications) {
        return null;
    }

    try {
        return Notifications.addNotificationResponseReceivedListener(listener);
    } catch {
        return null;
    }
}

export async function cancelAllScheduledNotifications(): Promise<void> {
    const Notifications = await getNotificationsModule();
    if (!Notifications) {
        return;
    }

    try {
        await Notifications.cancelAllScheduledNotificationsAsync();
    } catch { }
}

export async function scheduleTestNotification(): Promise<boolean> {
    const Notifications = await getNotificationsModule();
    if (!Notifications) {
        return false;
    }

    try {
        await Notifications.scheduleNotificationAsync({
            content: { title: "Test Notification", body: "This is a test notification!" },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 },
        });
        return true;
    } catch {
        return false;
    }
}

export const notificationService = {
    addNotification,
    addNotificationResponseReceivedListener,
    cancelAllScheduledNotifications,
    cancelMoodReminder,
    deleteNotification,
    ensureMoodReminderScheduled,
    getAllNotifications,
    getNotificationSettings,
    saveAllNotifications,
    saveNotificationSettings,
    scheduleTestNotification,
    updateNotification,
};
