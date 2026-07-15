import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

const notificationMocks = vi.hoisted(() => ({
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn(),
  SchedulableTriggerInputTypes: {
    DAILY: "daily",
    TIME_INTERVAL: "timeInterval",
  },
  AndroidImportance: {
    MAX: "max",
  },
}));

const platformMock = vi.hoisted(() => ({
  Platform: { OS: "ios" },
}));

const constantsMock = vi.hoisted(() => ({
  default: {
    executionEnvironment: "standalone",
    appOwnership: "standalone",
    expoGoConfig: null,
  },
  AppOwnership: { Expo: "expo" },
  ExecutionEnvironment: { StoreClient: "storeClient" },
}));

vi.mock("expo-notifications", () => notificationMocks);
vi.mock("react-native", () => platformMock);
vi.mock("expo-constants", () => constantsMock);

async function loadService() {
  vi.resetModules();
  return import("../../src/services/notificationService");
}

function reminder(id: string, enabled = true) {
  return {
    id,
    title: `Reminder ${id}`,
    body: "Check in",
    hour: 20,
    minute: 0,
    enabled,
  };
}

async function storedNotifications() {
  const raw = await AsyncStorage.getItem("notificationsList");
  return raw ? JSON.parse(raw) : null;
}

describe("notificationService scheduling persistence", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    vi.clearAllMocks();
    platformMock.Platform.OS = "ios";
    constantsMock.default.executionEnvironment = "standalone";
    constantsMock.default.appOwnership = "standalone";
    constantsMock.default.expoGoConfig = null;
    notificationMocks.getPermissionsAsync.mockResolvedValue({ status: "granted" });
    notificationMocks.requestPermissionsAsync.mockResolvedValue({ status: "granted" });
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    notificationMocks.scheduleNotificationAsync.mockImplementation(async (payload) => {
      return `scheduled-${payload.content.data.notificationId}`;
    });
  });

  it("returns scheduled outcomes, persists scheduled IDs, and does not mutate the caller array", async () => {
    const { saveAllNotifications } = await loadService();
    const input = [reminder("a")];

    const result = await saveAllNotifications(input);

    expect(result.status).toBe("scheduled");
    expect(result.notifications[0]).toMatchObject({
      id: "a",
      scheduledId: "scheduled-a",
      scheduleStatus: "scheduled",
      unscheduledReason: null,
    });
    expect(input[0]).not.toHaveProperty("scheduledId");
    expect(await storedNotifications()).toEqual(result.notifications);
  });

  it("persists permission-denied state without scheduling enabled reminders", async () => {
    const { saveAllNotifications } = await loadService();
    notificationMocks.getPermissionsAsync.mockResolvedValue({ status: "denied" });
    notificationMocks.requestPermissionsAsync.mockResolvedValue({ status: "denied" });

    const result = await saveAllNotifications([reminder("a")]);

    expect(result.status).toBe("permission-denied");
    expect(result.failedIds).toEqual(["a"]);
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(await storedNotifications()).toEqual([
      expect.objectContaining({
        id: "a",
        scheduleStatus: "permission-denied",
        unscheduledReason: "Notification permission was not granted.",
      }),
    ]);
  });

  it("returns unavailable when notifications cannot run in the current environment", async () => {
    const { saveAllNotifications } = await loadService();
    platformMock.Platform.OS = "android";
    constantsMock.default.executionEnvironment = "storeClient";
    constantsMock.default.appOwnership = "expo";

    const result = await saveAllNotifications([reminder("a")]);

    expect(result.status).toBe("unavailable");
    expect(result.failedIds).toEqual(["a"]);
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(await storedNotifications()).toEqual([
      expect.objectContaining({
        id: "a",
        scheduleStatus: "unavailable",
      }),
    ]);
  });

  it("persists a partial-failure result when only some reminders schedule", async () => {
    const { saveAllNotifications } = await loadService();
    notificationMocks.scheduleNotificationAsync
      .mockResolvedValueOnce("scheduled-a")
      .mockRejectedValueOnce(new Error("OS rejected reminder"));

    const result = await saveAllNotifications([reminder("a"), reminder("b")]);

    expect(result.status).toBe("partial-failure");
    expect(result.failedIds).toEqual(["b"]);
    expect(await storedNotifications()).toEqual([
      expect.objectContaining({
        id: "a",
        scheduledId: "scheduled-a",
        scheduleStatus: "scheduled",
      }),
      expect.objectContaining({
        id: "b",
        scheduleStatus: "failed",
        unscheduledReason: "OS rejected reminder",
      }),
    ]);
  });

  it("deletes reminders and cancels their scheduled notification", async () => {
    await AsyncStorage.setItem(
      "notificationsList",
      JSON.stringify([
        {
          ...reminder("a"),
          scheduledId: "scheduled-a",
          scheduleStatus: "scheduled",
        },
      ])
    );
    const { deleteNotification } = await loadService();

    const result = await deleteNotification("a");

    expect(result.status).toBe("disabled");
    expect(result.notifications).toEqual([]);
    expect(notificationMocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "scheduled-a"
    );
    expect(await storedNotifications()).toEqual([]);
  });

  it("does not recreate a legacy reminder when the saved list is disabled", async () => {
    await AsyncStorage.setItem(
      "notificationsList",
      JSON.stringify([
        {
          ...reminder("a", false),
          scheduledId: "scheduled-a",
          scheduleStatus: "scheduled",
        },
      ])
    );
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: "scheduled-a",
        content: {
          title: "How are you feeling?",
          data: { type: "mood-reminder" },
        },
      },
    ]);
    const { ensureMoodReminderScheduled } = await loadService();

    await ensureMoodReminderScheduled();

    expect(notificationMocks.getPermissionsAsync).not.toHaveBeenCalled();
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(notificationMocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "scheduled-a"
    );
    const stored = await storedNotifications();
    expect(stored).toEqual([
      expect.objectContaining({
        id: "a",
        enabled: false,
        scheduleStatus: "disabled",
      }),
    ]);
    expect(stored[0]).not.toHaveProperty("scheduledId");
  });

  it("reschedules enabled saved reminders through the list model when OS schedules are missing", async () => {
    await AsyncStorage.setItem(
      "notificationsList",
      JSON.stringify([
        {
          ...reminder("a"),
          scheduledId: "missing-schedule",
          scheduleStatus: "scheduled",
        },
      ])
    );
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    const { ensureMoodReminderScheduled } = await loadService();

    await ensureMoodReminderScheduled();

    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: { type: "mood-reminder", notificationId: "a" },
        }),
      })
    );
    expect(await storedNotifications()).toEqual([
      expect.objectContaining({
        id: "a",
        scheduledId: "scheduled-a",
        scheduleStatus: "scheduled",
      }),
    ]);
  });

  it("persists unavailable state during startup recovery when notifications cannot run", async () => {
    await AsyncStorage.setItem(
      "notificationsList",
      JSON.stringify([
        {
          ...reminder("a"),
          scheduledId: "stale-schedule",
          scheduleStatus: "scheduled",
        },
      ])
    );
    platformMock.Platform.OS = "android";
    constantsMock.default.executionEnvironment = "storeClient";
    constantsMock.default.appOwnership = "expo";
    const { ensureMoodReminderScheduled } = await loadService();

    const result = await ensureMoodReminderScheduled();

    expect(result?.status).toBe("unavailable");
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    const stored = await storedNotifications();
    expect(stored).toEqual([
      expect.objectContaining({
        id: "a",
        scheduleStatus: "unavailable",
      }),
    ]);
    expect(stored[0]).not.toHaveProperty("scheduledId");
  });

  it("persists permission-denied state during startup recovery when permission was revoked", async () => {
    await AsyncStorage.setItem(
      "notificationsList",
      JSON.stringify([
        {
          ...reminder("a"),
          scheduledId: "missing-schedule",
          scheduleStatus: "scheduled",
        },
      ])
    );
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    notificationMocks.getPermissionsAsync.mockResolvedValue({ status: "denied" });
    notificationMocks.requestPermissionsAsync.mockResolvedValue({ status: "denied" });
    const { ensureMoodReminderScheduled } = await loadService();

    const result = await ensureMoodReminderScheduled();

    expect(result?.status).toBe("permission-denied");
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    const stored = await storedNotifications();
    expect(stored).toEqual([
      expect.objectContaining({
        id: "a",
        scheduleStatus: "permission-denied",
        unscheduledReason: "Notification permission was not granted.",
      }),
    ]);
    expect(stored[0]).not.toHaveProperty("scheduledId");
  });
});
