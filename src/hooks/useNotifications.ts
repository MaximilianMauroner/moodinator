import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
    addNotificationResponseReceivedListener,
    ensureMoodReminderScheduled,
} from "@/services/notificationService";

type RemovableSubscription = { remove: () => void };

type NotificationLifecycleDependencies = {
    ensureMoodReminderScheduled: () => Promise<unknown>;
    addNotificationResponseReceivedListener: typeof addNotificationResponseReceivedListener;
    addAppStateChangeListener: (
        listener: (state: AppStateStatus) => void
    ) => RemovableSubscription;
    onError: (error: unknown) => void;
};

const defaultLifecycleDependencies: NotificationLifecycleDependencies = {
    ensureMoodReminderScheduled,
    addNotificationResponseReceivedListener,
    addAppStateChangeListener: (listener) => AppState.addEventListener("change", listener),
    onError: (error) => {
        console.warn("Failed to recover mood reminders:", error);
    },
};

export function startNotificationLifecycle(
    dependencies: Partial<NotificationLifecycleDependencies> = {}
): () => void {
    const deps = { ...defaultLifecycleDependencies, ...dependencies };
    let notificationSubscription: RemovableSubscription | null = null;
    let cancelled = false;

    const recoverReminders = () => {
        void deps.ensureMoodReminderScheduled().catch(deps.onError);
    };

    recoverReminders();

    const appStateSubscription = deps.addAppStateChangeListener((state) => {
        if (state === "active") {
            recoverReminders();
        }
    });

    void deps.addNotificationResponseReceivedListener(() => {
        // Reserved for future deep-link handling from reminder taps.
    }).then((nextSubscription) => {
        if (!nextSubscription) {
            return;
        }

        if (cancelled) {
            nextSubscription.remove();
            return;
        }

        notificationSubscription = nextSubscription;
    }).catch(deps.onError);

    return () => {
        cancelled = true;
        notificationSubscription?.remove();
        appStateSubscription.remove();
    };
}

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
        return startNotificationLifecycle();
    }, []);
}
