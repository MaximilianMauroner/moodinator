import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
    addNotificationResponseReceivedListener,
    clearLastNotificationResponse,
    ensureMoodReminderScheduled,
    getLastNotificationResponse,
    getNotificationResponseIdentity,
    isMoodReminderResponse,
    type NotificationResponse,
} from "@/services/notificationService";

type RemovableSubscription = { remove: () => void };

type NotificationLifecycleDependencies = {
    ensureMoodReminderScheduled: () => Promise<unknown>;
    addNotificationResponseReceivedListener: typeof addNotificationResponseReceivedListener;
    getLastNotificationResponse: () => Promise<NotificationResponse | null>;
    clearLastNotificationResponse: () => Promise<void>;
    addAppStateChangeListener: (
        listener: (state: AppStateStatus) => void
    ) => RemovableSubscription;
    onMoodReminderResponse: () => void;
    onError: (error: unknown) => void;
};

const defaultLifecycleDependencies: NotificationLifecycleDependencies = {
    ensureMoodReminderScheduled,
    addNotificationResponseReceivedListener,
    getLastNotificationResponse,
    clearLastNotificationResponse,
    addAppStateChangeListener: (listener) => AppState.addEventListener("change", listener),
    onMoodReminderResponse: () => undefined,
    onError: (error) => {
        console.warn("Failed to handle notification lifecycle:", error);
    },
};

const ignoreMoodReminderResponse = () => undefined;

type PendingReminderNavigationDependencies = {
    isReady: () => boolean;
    subscribeToState: (listener: () => void) => () => void;
    navigate: () => void;
};

export function startPendingReminderNavigation(
    dependencies: PendingReminderNavigationDependencies
): () => void {
    let completed = false;
    let subscriptionActive = false;
    let unsubscribe: () => void = () => undefined;

    const stopListening = () => {
        if (subscriptionActive) {
            subscriptionActive = false;
            unsubscribe();
        }
    };

    const navigateWhenReady = () => {
        if (completed || !dependencies.isReady()) {
            return;
        }
        dependencies.navigate();
        completed = true;
        stopListening();
    };

    unsubscribe = dependencies.subscribeToState(navigateWhenReady);
    subscriptionActive = true;
    if (completed) {
        stopListening();
    } else {
        navigateWhenReady();
    }

    return () => {
        completed = true;
        stopListening();
    };
}

export function startNotificationLifecycle(
    dependencies: Partial<NotificationLifecycleDependencies> = {}
): () => void {
    const deps = { ...defaultLifecycleDependencies, ...dependencies };
    const handledResponseIds = new Set<string>();
    let notificationSubscription: RemovableSubscription | null = null;
    let cancelled = false;

    const recoverReminders = () => {
        void deps.ensureMoodReminderScheduled().catch(deps.onError);
    };

    const handleResponse = (response: unknown) => {
        if (cancelled || !isMoodReminderResponse(response)) {
            return;
        }

        const responseId = getNotificationResponseIdentity(response);
        if (!handledResponseIds.has(responseId)) {
            handledResponseIds.add(responseId);
            deps.onMoodReminderResponse();
        }
        void deps.clearLastNotificationResponse().catch(deps.onError);
    };

    recoverReminders();

    const appStateSubscription = deps.addAppStateChangeListener((state) => {
        if (state === "active") {
            recoverReminders();
        }
    });

    void deps.addNotificationResponseReceivedListener(handleResponse)
        .then((nextSubscription) => {
            if (!nextSubscription) {
                return;
            }
            if (cancelled) {
                nextSubscription.remove();
                return;
            }
            notificationSubscription = nextSubscription;
        })
        .catch(deps.onError);

    void deps.getLastNotificationResponse()
        .then(handleResponse)
        .catch(deps.onError);

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
    ensureMoodReminderScheduled,
    getAllNotifications,
    getNotificationSettings,
    saveAllNotifications,
    saveNotificationSettings,
    updateNotification,
} from "@/services/notificationService";

export function useNotifications(onMoodReminderResponse: () => void = ignoreMoodReminderResponse) {
    useEffect(() => {
        return startNotificationLifecycle({ onMoodReminderResponse });
    }, [onMoodReminderResponse]);
}
