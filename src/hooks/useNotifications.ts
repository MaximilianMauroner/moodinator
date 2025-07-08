import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { add, isBefore } from 'date-fns';
import { hasMoodBeenLoggedToday } from '../../db/db';

const NOTIFICATION_ID = 'mood-reminder';

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

export async function scheduleMoodReminder() {
    const loggedToday = await hasMoodBeenLoggedToday();
    if (loggedToday) {
        await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
        return; // Don't schedule if already logged
    }

    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);

    await Notifications.scheduleNotificationAsync({
        content: {
            title: '👋 How are you feeling?',
            body: "Don't forget to log your mood for today!",
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            repeats: true,
            hour: 20, // 8 PM
            minute: 0,
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
        scheduleMoodReminder();

        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            console.log(response);
        });

        return () => subscription.remove();
    }, []);
}
