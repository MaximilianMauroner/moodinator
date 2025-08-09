import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATIONS_ENABLED_KEY = 'notificationsEnabled';
const NOTIFICATION_TIME_KEY = 'notificationTime';
const NOTIFICATION_SCHEDULED_ID_KEY = 'moodReminderScheduledId';

// Constants to identify our app's reminder notifications
const MOOD_REMINDER_TITLE = '👋 How are you feeling?';
const MOOD_REMINDER_TAG = 'mood-reminder';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
    }),
});

async function registerForPushNotificationsAsync() {
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
        console.warn('Notifications permission not granted');
        return;
    }
}

// Helper to cancel any stray mood reminder notifications (from older versions)
async function cancelAllMoodReminders() {
    try {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        for (const n of scheduled) {
            const anyN: any = n as any;
            const title = anyN?.content?.title as string | undefined;
            const tag = anyN?.content?.data?.type as string | undefined;
            if (title === MOOD_REMINDER_TITLE || tag === MOOD_REMINDER_TAG) {
                try {
                    await Notifications.cancelScheduledNotificationAsync(anyN.identifier);
                } catch { }
            }
        }
    } catch { }
}

// Ensures only a single repeating daily reminder is scheduled
export async function scheduleMoodReminder(customHour?: number, customMinute?: number) {
    // Respect user setting
    const notificationsEnabled = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    if (notificationsEnabled === 'false') {
        await cancelMoodReminder();
        return;
    }

    // Cancel any previously scheduled reminder using stored ID
    const existingId = await AsyncStorage.getItem(NOTIFICATION_SCHEDULED_ID_KEY);
    if (existingId) {
        try {
            await Notifications.cancelScheduledNotificationAsync(existingId);
        } catch (e) {
            console.warn('Failed to cancel existing scheduled notification:', e);
        }
        await AsyncStorage.removeItem(NOTIFICATION_SCHEDULED_ID_KEY);
    }

    // Additionally, clear any stray mood reminders that may not be tracked by ID
    await cancelAllMoodReminders();

    // Determine desired time
    let hour = customHour ?? 20; // Default 8 PM
    let minute = customMinute ?? 0;

    if (customHour === undefined && customMinute === undefined) {
        const savedTime = await AsyncStorage.getItem(NOTIFICATION_TIME_KEY);
        if (savedTime) {
            const timeData = JSON.parse(savedTime);
            hour = timeData.hour;
            minute = timeData.minute;
        }
    }

    // Schedule a daily repeating notification at the chosen time
    const id = await Notifications.scheduleNotificationAsync({
        content: {
            title: MOOD_REMINDER_TITLE,
            body: "Don't forget to log your mood for today!",
            data: { type: MOOD_REMINDER_TAG },
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            repeats: true,
            hour,
            minute,
        },
    });

    await AsyncStorage.setItem(NOTIFICATION_SCHEDULED_ID_KEY, id);
}

export async function cancelMoodReminder() {
    const existingId = await AsyncStorage.getItem(NOTIFICATION_SCHEDULED_ID_KEY);
    if (existingId) {
        try {
            await Notifications.cancelScheduledNotificationAsync(existingId);
        } catch (e) {
            console.warn('Failed to cancel scheduled notification:', e);
        }
        await AsyncStorage.removeItem(NOTIFICATION_SCHEDULED_ID_KEY);
    }

    // Also cancel any stray mood reminders that may exist
    await cancelAllMoodReminders();
}

export function useNotifications() {
    useEffect(() => {
        registerForPushNotificationsAsync();

        // (Re)schedule on app start if enabled
        const checkAndSchedule = async () => {
            const notificationsEnabled = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
            if (notificationsEnabled !== 'false') {
                await scheduleMoodReminder();
            } else {
                await cancelMoodReminder();
            }
        };

        checkAndSchedule();

        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            // Handle notification response if needed
        });

        return () => subscription.remove();
    }, []);
}

// Helper functions for managing notification settings
export async function saveNotificationSettings(enabled: boolean, hour: number, minute: number) {
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled.toString());
    await AsyncStorage.setItem(NOTIFICATION_TIME_KEY, JSON.stringify({ hour, minute }));

    if (enabled) {
        await scheduleMoodReminder(hour, minute);
    } else {
        await cancelMoodReminder();
    }
}

export async function getNotificationSettings(): Promise<{ enabled: boolean; hour: number; minute: number }> {
    const enabled = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    const timeData = await AsyncStorage.getItem(NOTIFICATION_TIME_KEY);

    let hour = 20; // Default 8 PM
    let minute = 0;

    if (timeData) {
        const parsed = JSON.parse(timeData);
        hour = parsed.hour;
        minute = parsed.minute;
    }

    return {
        enabled: enabled !== 'false', // Default to true if not set
        hour,
        minute,
    };
}
