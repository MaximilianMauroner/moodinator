import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { add, isBefore } from 'date-fns';
import { hasMoodBeenLoggedToday } from '../../db/db';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_ID = 'mood-reminder';
const NOTIFICATIONS_ENABLED_KEY = 'notificationsEnabled';
const NOTIFICATION_TIME_KEY = 'notificationTime';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

async function registerForPushNotificationsAsync() {
    let token;
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
        alert('Failed to get push token for push notification!');
        return;
    }
    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log(token);

    return token;
}

export async function scheduleMoodReminder(customHour?: number, customMinute?: number) {
    // Check if notifications are enabled
    const notificationsEnabled = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    if (notificationsEnabled === 'false') {
        await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
        return;
    }

    const loggedToday = await hasMoodBeenLoggedToday();
    if (loggedToday) {
        await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
        return; // Don't schedule if already logged
    }

    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);

    // Get custom time or use default
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

    await Notifications.scheduleNotificationAsync({
        content: {
            title: '👋 How are you feeling?',
            body: "Don't forget to log your mood for today!",
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            repeats: true,
            hour,
            minute,
        },
        identifier: NOTIFICATION_ID,
    });
}

export async function cancelMoodReminder() {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
}

export function useNotifications() {
    useEffect(() => {
        registerForPushNotificationsAsync();

        // Check if notifications should be scheduled on app start
        const checkAndSchedule = async () => {
            const notificationsEnabled = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
            if (notificationsEnabled !== 'false') {
                scheduleMoodReminder();
            }
        };

        checkAndSchedule();

        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            console.log(response);
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
