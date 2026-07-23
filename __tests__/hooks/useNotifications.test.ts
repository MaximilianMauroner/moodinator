import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationResponse } from "../../src/services/notificationService";
import {
  startNotificationLifecycle,
} from "../../src/hooks/useNotifications";

const serviceMocks = vi.hoisted(() => ({
  ensureMoodReminderScheduled: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn(),
  getLastNotificationResponse: vi.fn(),
  clearLastNotificationResponse: vi.fn(),
}));

vi.mock("react-native", () => ({
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

vi.mock("@/services/notificationService", () => ({
  ensureMoodReminderScheduled: serviceMocks.ensureMoodReminderScheduled,
  addNotificationResponseReceivedListener: serviceMocks.addNotificationResponseReceivedListener,
  getLastNotificationResponse: serviceMocks.getLastNotificationResponse,
  clearLastNotificationResponse: serviceMocks.clearLastNotificationResponse,
  isMoodReminderResponse: (response: unknown) => {
    if (typeof response !== "object" || response === null || !("notification" in response)) {
      return false;
    }
    const notification = response.notification;
    if (typeof notification !== "object" || notification === null || !("request" in notification)) {
      return false;
    }
    const request = notification.request;
    if (typeof request !== "object" || request === null || !("content" in request)) {
      return false;
    }
    const content = request.content;
    if (typeof content !== "object" || content === null || !("data" in content)) {
      return false;
    }
    const data = content.data;
    return typeof data === "object" && data !== null && "type" in data && data.type === "mood-reminder";
  },
  getNotificationResponseIdentity: (response: NotificationResponse) =>
    `${response.notification.request.identifier}:${response.notification.date}:${response.actionIdentifier}`,
  addNotification: vi.fn(),
  cancelMoodReminder: vi.fn(),
  deleteNotification: vi.fn(),
  getAllNotifications: vi.fn(),
  getNotificationSettings: vi.fn(),
  saveAllNotifications: vi.fn(),
  saveNotificationSettings: vi.fn(),
  updateNotification: vi.fn(),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function response(type: string, date = 123): NotificationResponse {
  return {
    actionIdentifier: "default",
    notification: {
      date,
      request: {
        identifier: "daily-reminder",
        content: {
          title: "Reminder",
          subtitle: null,
          body: "Check in",
          data: { type },
          categoryIdentifier: null,
          sound: null,
        },
        trigger: null,
      },
    },
  };
}

describe("notification lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.getLastNotificationResponse.mockResolvedValue(null);
    serviceMocks.clearLastNotificationResponse.mockResolvedValue(undefined);
  });

  it("recovers scheduled reminders and removes listeners on cleanup", async () => {
    const removeNotificationListener = vi.fn();
    const removeAppStateListener = vi.fn();
    const ensureMoodReminderScheduled = vi.fn().mockResolvedValue(undefined);
    const addNotificationResponseReceivedListener = vi
      .fn()
      .mockResolvedValue({ remove: removeNotificationListener });
    const addAppStateChangeListener = vi.fn().mockReturnValue({
      remove: removeAppStateListener,
    });

    const cleanup = startNotificationLifecycle({
      ensureMoodReminderScheduled,
      addNotificationResponseReceivedListener,
      addAppStateChangeListener,
    });
    await Promise.resolve();

    cleanup();

    expect(ensureMoodReminderScheduled).toHaveBeenCalledTimes(1);
    expect(addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    expect(addAppStateChangeListener).toHaveBeenCalledTimes(1);
    expect(removeNotificationListener).toHaveBeenCalledTimes(1);
    expect(removeAppStateListener).toHaveBeenCalledTimes(1);
  });

  it("removes the tap listener if cleanup runs before listener registration resolves", async () => {
    const removeNotificationListener = vi.fn();
    const listenerRegistration = createDeferred<{ remove: () => void } | null>();
    const ensureMoodReminderScheduled = vi.fn().mockResolvedValue(undefined);
    const addNotificationResponseReceivedListener = vi
      .fn()
      .mockReturnValue(listenerRegistration.promise);
    const addAppStateChangeListener = vi.fn().mockReturnValue({ remove: vi.fn() });

    const cleanup = startNotificationLifecycle({
      ensureMoodReminderScheduled,
      addNotificationResponseReceivedListener,
      addAppStateChangeListener,
    });

    cleanup();
    listenerRegistration.resolve({ remove: removeNotificationListener });
    await listenerRegistration.promise;

    expect(removeNotificationListener).toHaveBeenCalledTimes(1);
  });

  it("retries reminder recovery when the app becomes active", () => {
    let appStateListener: ((state: "active" | "background" | "inactive") => void) | null = null;
    const ensureMoodReminderScheduled = vi.fn().mockResolvedValue(undefined);
    const addNotificationResponseReceivedListener = vi.fn().mockResolvedValue(null);
    const addAppStateChangeListener = vi.fn((listener) => {
      appStateListener = listener;
      return { remove: vi.fn() };
    });

    startNotificationLifecycle({
      ensureMoodReminderScheduled,
      addNotificationResponseReceivedListener,
      addAppStateChangeListener,
    });

    appStateListener?.("background");
    appStateListener?.("active");

    expect(ensureMoodReminderScheduled).toHaveBeenCalledTimes(2);
  });

  it("logs recovery failures without throwing during lifecycle startup", async () => {
    const error = new Error("permission service unavailable");
    const onError = vi.fn();
    const ensureMoodReminderScheduled = vi.fn().mockRejectedValue(error);
    const addNotificationResponseReceivedListener = vi.fn().mockResolvedValue(null);
    const addAppStateChangeListener = vi.fn().mockReturnValue({ remove: vi.fn() });

    expect(() =>
      startNotificationLifecycle({
        ensureMoodReminderScheduled,
        addNotificationResponseReceivedListener,
        addAppStateChangeListener,
        onError,
      })
    ).not.toThrow();
    await Promise.resolve();

    expect(onError).toHaveBeenCalledWith(error);
  });

  it("routes a live mood reminder response and clears it", async () => {
    let responseListener: ((nextResponse: NotificationResponse) => void) | null = null;
    const onMoodReminderResponse = vi.fn();
    const addNotificationResponseReceivedListener = vi.fn((listener) => {
      responseListener = listener;
      return Promise.resolve({ remove: vi.fn() });
    });

    startNotificationLifecycle({
      ensureMoodReminderScheduled: vi.fn().mockResolvedValue(undefined),
      addNotificationResponseReceivedListener,
      getLastNotificationResponse: vi.fn().mockResolvedValue(null),
      clearLastNotificationResponse: serviceMocks.clearLastNotificationResponse,
      addAppStateChangeListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
      onMoodReminderResponse,
    });
    await Promise.resolve();
    responseListener?.(response("mood-reminder"));
    await Promise.resolve();

    expect(onMoodReminderResponse).toHaveBeenCalledTimes(1);
    expect(serviceMocks.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
  });

  it("deduplicates the same cold-start and live mood reminder response", async () => {
    const coldResponse = response("mood-reminder");
    let responseListener: ((nextResponse: NotificationResponse) => void) | null = null;
    const onMoodReminderResponse = vi.fn();

    startNotificationLifecycle({
      ensureMoodReminderScheduled: vi.fn().mockResolvedValue(undefined),
      addNotificationResponseReceivedListener: vi.fn((listener) => {
        responseListener = listener;
        return Promise.resolve({ remove: vi.fn() });
      }),
      getLastNotificationResponse: vi.fn().mockResolvedValue(coldResponse),
      clearLastNotificationResponse: serviceMocks.clearLastNotificationResponse,
      addAppStateChangeListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
      onMoodReminderResponse,
    });
    await Promise.resolve();
    await Promise.resolve();
    responseListener?.(coldResponse);
    await Promise.resolve();

    expect(onMoodReminderResponse).toHaveBeenCalledTimes(1);
    expect(serviceMocks.clearLastNotificationResponse).toHaveBeenCalled();
  });

  it("ignores unrelated notification responses", async () => {
    const onMoodReminderResponse = vi.fn();

    startNotificationLifecycle({
      ensureMoodReminderScheduled: vi.fn().mockResolvedValue(undefined),
      addNotificationResponseReceivedListener: vi.fn().mockResolvedValue(null),
      getLastNotificationResponse: vi.fn().mockResolvedValue(response("backup-complete")),
      clearLastNotificationResponse: serviceMocks.clearLastNotificationResponse,
      addAppStateChangeListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
      onMoodReminderResponse,
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(onMoodReminderResponse).not.toHaveBeenCalled();
    expect(serviceMocks.clearLastNotificationResponse).not.toHaveBeenCalled();
  });
});
