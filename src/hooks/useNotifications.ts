import { useEffect } from "react";
import {
    addNotificationResponseReceivedListener,
    ensureMoodReminderScheduled,
} from "@/services/notificationService";

export type {
    NotificationConfig,
    ReminderScheduleResult,
    ReminderScheduleStatus,
} from "@/services/notificationService";
export {
    addNotification,
    cancelMoodReminder,
    deleteNotification,
    getAllNotifications,
    getNotificationSettings,
    saveAllNotifications,
    saveNotificationSettings,
    updateNotification,
} from "@/services/notificationService";

export function useNotifications() {
    useEffect(() => {
        let subscription: { remove: () => void } | null = null;
        let cancelled = false;

        void ensureMoodReminderScheduled();

        void addNotificationResponseReceivedListener(() => {
            // Reserved for future deep-link handling from reminder taps.
        }).then((nextSubscription) => {
            if (!nextSubscription) {
                return;
            }

            if (cancelled) {
                nextSubscription.remove();
                return;
            }

            subscription = nextSubscription;
        });

        return () => {
            cancelled = true;
            subscription?.remove();
        };
    }, []);
}
