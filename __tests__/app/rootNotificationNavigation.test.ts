import { describe, expect, it, vi } from "vitest";

import { startPendingReminderNavigation } from "../../src/hooks/useNotifications";

vi.mock("react-native", () => ({
  AppState: { addEventListener: vi.fn() },
}));

vi.mock("@/services/notificationService", () => ({
  addNotification: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn(),
  cancelMoodReminder: vi.fn(),
  clearLastNotificationResponse: vi.fn(),
  deleteNotification: vi.fn(),
  ensureMoodReminderScheduled: vi.fn(),
  getAllNotifications: vi.fn(),
  getLastNotificationResponse: vi.fn(),
  getNotificationSettings: vi.fn(),
  getNotificationResponseIdentity: vi.fn(),
  isMoodReminderResponse: vi.fn(),
  saveAllNotifications: vi.fn(),
  saveNotificationSettings: vi.fn(),
  updateNotification: vi.fn(),
}));

describe("root layout reminder navigation", () => {
  it("keeps an early tap pending and routes exactly once when the navigator becomes ready", () => {
    let ready = false;
    let stateListener: (() => void) | null = null;
    const removeStateListener = vi.fn();
    const replaceHomeRoute = vi.fn();

    const cleanup = startPendingReminderNavigation({
      isReady: () => ready,
      subscribeToState: (listener) => {
        stateListener = listener;
        return removeStateListener;
      },
      navigate: replaceHomeRoute,
    });

    expect(replaceHomeRoute).not.toHaveBeenCalled();

    ready = true;
    stateListener?.();
    stateListener?.();

    expect(replaceHomeRoute).toHaveBeenCalledTimes(1);
    expect(removeStateListener).toHaveBeenCalledTimes(1);

    cleanup();
    expect(removeStateListener).toHaveBeenCalledTimes(1);
  });
});
