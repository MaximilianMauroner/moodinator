import { describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  ensureMoodReminderScheduled: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn(),
}));

vi.mock("react-native", () => ({
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

vi.mock("@/services/notificationService", () => ({
  ensureMoodReminderScheduled: serviceMocks.ensureMoodReminderScheduled,
  addNotificationResponseReceivedListener: serviceMocks.addNotificationResponseReceivedListener,
  addNotification: vi.fn(),
  cancelMoodReminder: vi.fn(),
  deleteNotification: vi.fn(),
  getAllNotifications: vi.fn(),
  getNotificationSettings: vi.fn(),
  saveAllNotifications: vi.fn(),
  saveNotificationSettings: vi.fn(),
  updateNotification: vi.fn(),
}));

import { startNotificationLifecycle } from "../../src/hooks/useNotifications";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("notification lifecycle", () => {
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
});
