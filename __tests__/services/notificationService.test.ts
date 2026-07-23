import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

const notificationMocks = vi.hoisted(() => ({
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  getNotificationChannelAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn(),
  getLastNotificationResponseAsync: vi.fn(),
  clearLastNotificationResponseAsync: vi.fn(),
  cancelAllScheduledNotificationsAsync: vi.fn(),
  SchedulableTriggerInputTypes: {
    DAILY: "daily",
    TIME_INTERVAL: "timeInterval",
  },
  AndroidImportance: {
    MAX: "max",
    NONE: "none",
  },
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
}));

const platformMock = vi.hoisted(() => ({
  Platform: { OS: "ios" },
}));

const localizationMock = vi.hoisted(() => ({
  timeZone: "Etc/UTC",
  getCalendars: vi.fn(() => [{ timeZone: localizationMock.timeZone }]),
}));

vi.mock("expo-notifications", () => notificationMocks);
vi.mock("react-native", () => platformMock);
vi.mock("expo-localization", () => ({ getCalendars: localizationMock.getCalendars }));

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
    localizationMock.timeZone = "Etc/UTC";
    notificationMocks.setNotificationChannelAsync.mockResolvedValue({ importance: "max" });
    notificationMocks.getNotificationChannelAsync.mockResolvedValue({ importance: "max" });
    notificationMocks.getPermissionsAsync.mockResolvedValue({ status: "granted" });
    notificationMocks.requestPermissionsAsync.mockResolvedValue({ status: "granted" });
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    notificationMocks.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
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
    expect(notificationMocks.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(await storedNotifications()).toEqual([
      expect.objectContaining({
        id: "a",
        scheduleStatus: "permission-denied",
        unscheduledReason: "Notification permission was not granted.",
      }),
    ]);
  });

  it("uses provisional iOS permission during passive recovery without prompting", async () => {
    await AsyncStorage.setItem(
      "notificationsList",
      JSON.stringify([{ ...reminder("a"), scheduledId: "missing", scheduleStatus: "scheduled" }])
    );
    notificationMocks.getPermissionsAsync.mockResolvedValue({
      status: "undetermined",
      ios: { status: 3 },
    });
    const { ensureMoodReminderScheduled } = await loadService();

    const result = await ensureMoodReminderScheduled();

    expect(result.status).toBe("scheduled");
    expect(notificationMocks.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("uses ephemeral iOS permission without prompting", async () => {
    notificationMocks.getPermissionsAsync.mockResolvedValue({
      status: "undetermined",
      ios: { status: 4 },
    });
    const { saveAllNotifications } = await loadService();

    const result = await saveAllNotifications([reminder("a")]);

    expect(result.status).toBe("scheduled");
    expect(notificationMocks.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("schedules local reminders in Android Expo Go", async () => {
    const { saveAllNotifications } = await loadService();
    platformMock.Platform.OS = "android";

    const result = await saveAllNotifications([reminder("a")]);

    expect(result.status).toBe("scheduled");
    expect(notificationMocks.setNotificationChannelAsync).toHaveBeenCalledWith(
      "default",
      expect.any(Object)
    );
    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
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
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: "scheduled-a",
        content: { data: { type: "mood-reminder" } },
      },
    ]);
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

  it("persists a blocked Android channel warning even when the saved ID is valid", async () => {
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
    await AsyncStorage.setItem("notificationScheduleTimeZone", "Etc/UTC");
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: "scheduled-a",
        content: { data: { type: "mood-reminder" } },
      },
    ]);
    platformMock.Platform.OS = "android";
    notificationMocks.getNotificationChannelAsync.mockResolvedValue({ importance: "none" });
    const { ensureMoodReminderScheduled } = await loadService();

    const result = await ensureMoodReminderScheduled();

    expect(result?.status).toBe("permission-denied");
    expect(notificationMocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    const stored = await storedNotifications();
    expect(stored).toEqual([
      expect.objectContaining({
        id: "a",
        scheduleStatus: "permission-denied",
        unscheduledReason: "The Moodinator notification channel is disabled in system settings.",
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
    expect(notificationMocks.requestPermissionsAsync).not.toHaveBeenCalled();
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

  it("does not churn valid schedules when access and timezone are unchanged", async () => {
    await AsyncStorage.setItem(
      "notificationsList",
      JSON.stringify([{ ...reminder("a"), scheduledId: "scheduled-a", scheduleStatus: "scheduled" }])
    );
    await AsyncStorage.setItem("notificationScheduleTimeZone", "Etc/UTC");
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "scheduled-a", content: { data: { type: "mood-reminder" } } },
    ]);
    const { ensureMoodReminderScheduled } = await loadService();

    const result = await ensureMoodReminderScheduled();

    expect(result).toBeNull();
    expect(notificationMocks.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("rebuilds once after a timezone change and persists the new timezone", async () => {
    await AsyncStorage.setItem(
      "notificationsList",
      JSON.stringify([{ ...reminder("a"), scheduledId: "scheduled-a", scheduleStatus: "scheduled" }])
    );
    await AsyncStorage.setItem("notificationScheduleTimeZone", "Europe/Vienna");
    localizationMock.timeZone = "America/New_York";
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "scheduled-a", content: { data: { type: "mood-reminder" } } },
    ]);
    const { ensureMoodReminderScheduled } = await loadService();

    const firstResult = await ensureMoodReminderScheduled();
    const secondResult = await ensureMoodReminderScheduled();

    expect(firstResult?.status).toBe("scheduled");
    expect(secondResult).toBeNull();
    expect(notificationMocks.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem("notificationScheduleTimeZone")).toBe("America/New_York");
  });

  it("fails closed when scheduled reminders cannot be listed", async () => {
    await AsyncStorage.setItem(
      "notificationsList",
      JSON.stringify([{ ...reminder("a"), scheduledId: "scheduled-a", scheduleStatus: "scheduled" }])
    );
    notificationMocks.getAllScheduledNotificationsAsync.mockRejectedValue(new Error("list unavailable"));
    const { ensureMoodReminderScheduled } = await loadService();

    const result = await ensureMoodReminderScheduled();

    expect(result?.status).toBe("failed");
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(await storedNotifications()).toEqual([
      expect.objectContaining({
        id: "a",
        enabled: true,
        scheduleStatus: "failed",
        unscheduledReason: "list unavailable",
      }),
    ]);

    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "scheduled-a", content: { data: { type: "mood-reminder" } } },
    ]);
    const retry = await ensureMoodReminderScheduled();

    expect(retry?.status).toBe("scheduled");
    expect(notificationMocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith("scheduled-a");
    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it("fails closed when an existing reminder cannot be cancelled", async () => {
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "old-a", content: { data: { type: "mood-reminder" } } },
    ]);
    notificationMocks.cancelScheduledNotificationAsync.mockRejectedValue(new Error("cancel unavailable"));
    const { saveAllNotifications } = await loadService();

    const result = await saveAllNotifications([reminder("a")]);

    expect(result.status).toBe("failed");
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(result.notifications).toEqual([
      expect.objectContaining({
        id: "a",
        enabled: true,
        scheduleStatus: "failed",
        unscheduledReason: "cancel unavailable",
      }),
    ]);
    expect(await AsyncStorage.getItem("notificationScheduleTimeZone")).toBeNull();
  });

  it("keeps a delete tombstone after listing fails and removes it after passive retry", async () => {
    await AsyncStorage.setItem(
      "notificationsList",
      JSON.stringify([{ ...reminder("a"), scheduledId: "scheduled-a", scheduleStatus: "scheduled" }])
    );
    notificationMocks.getAllScheduledNotificationsAsync.mockRejectedValueOnce(
      new Error("list unavailable")
    );
    const { deleteNotification, ensureMoodReminderScheduled } = await loadService();

    const result = await deleteNotification("a");

    expect(result.status).toBe("failed");
    expect(await storedNotifications()).toEqual([
      expect.objectContaining({
        id: "a",
        enabled: true,
        scheduledId: "scheduled-a",
        pendingAction: "delete",
        scheduleStatus: "failed",
      }),
    ]);

    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "scheduled-a", content: { data: { type: "mood-reminder" } } },
    ]);
    const retry = await ensureMoodReminderScheduled();

    expect(retry?.status).toBe("disabled");
    expect(notificationMocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith("scheduled-a");
    expect(await storedNotifications()).toEqual([]);
  });

  it("preserves desired disabled edits after cancellation fails and applies them after passive retry", async () => {
    await AsyncStorage.setItem(
      "notificationsList",
      JSON.stringify([{ ...reminder("a"), scheduledId: "scheduled-a", scheduleStatus: "scheduled" }])
    );
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "scheduled-a", content: { data: { type: "mood-reminder" } } },
    ]);
    notificationMocks.cancelScheduledNotificationAsync.mockRejectedValueOnce(
      new Error("cancel unavailable")
    );
    const { ensureMoodReminderScheduled, updateNotification } = await loadService();

    const result = await updateNotification("a", {
      enabled: false,
      title: "Updated reminder",
      body: "Updated check in",
      hour: 9,
      minute: 15,
    });

    expect(result.status).toBe("failed");
    expect(await storedNotifications()).toEqual([
      expect.objectContaining({
        id: "a",
        enabled: false,
        title: "Updated reminder",
        body: "Updated check in",
        hour: 9,
        minute: 15,
        scheduledId: "scheduled-a",
        pendingAction: "disable",
        scheduleStatus: "failed",
      }),
    ]);

    const retry = await ensureMoodReminderScheduled();

    expect(retry?.status).toBe("disabled");
    expect(await storedNotifications()).toEqual([
      expect.objectContaining({
        id: "a",
        enabled: false,
        title: "Updated reminder",
        body: "Updated check in",
        hour: 9,
        minute: 15,
        scheduleStatus: "disabled",
      }),
    ]);
    expect((await storedNotifications())[0]).not.toHaveProperty("pendingAction");
  });

  it("keeps cancelMoodReminder visibly pending after list failure and completes on passive retry", async () => {
    await AsyncStorage.setItem("notificationsEnabled", "true");
    await AsyncStorage.setItem(
      "notificationsList",
      JSON.stringify([{ ...reminder("a"), scheduledId: "scheduled-a", scheduleStatus: "scheduled" }])
    );
    notificationMocks.getAllScheduledNotificationsAsync.mockRejectedValueOnce(
      new Error("list unavailable")
    );
    const { cancelMoodReminder, ensureMoodReminderScheduled } = await loadService();

    const result = await cancelMoodReminder();

    expect(result.status).toBe("failed");
    expect(await AsyncStorage.getItem("notificationsEnabled")).toBe("true");
    expect(await storedNotifications()).toEqual([
      expect.objectContaining({
        id: "a",
        enabled: false,
        scheduledId: "scheduled-a",
        pendingAction: "disable",
        scheduleStatus: "failed",
      }),
    ]);

    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "scheduled-a", content: { data: { type: "mood-reminder" } } },
    ]);
    const retry = await ensureMoodReminderScheduled();

    expect(retry?.status).toBe("disabled");
    expect(notificationMocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith("scheduled-a");
    expect((await storedNotifications())[0]).toEqual(expect.objectContaining({ enabled: false }));
  });

  it("resolves a failed disable before adding and never re-schedules the disabled reminder", async () => {
    await AsyncStorage.setItem(
      "notificationsList",
      JSON.stringify([{ ...reminder("a"), scheduledId: "scheduled-a", scheduleStatus: "scheduled" }])
    );
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "scheduled-a", content: { data: { type: "mood-reminder" } } },
    ]);
    notificationMocks.cancelScheduledNotificationAsync.mockRejectedValueOnce(
      new Error("cancel unavailable")
    );
    const { addNotification, updateNotification } = await loadService();

    await updateNotification("a", { enabled: false });
    const added = await addNotification({
      title: "New reminder",
      body: "New check in",
      hour: 18,
      minute: 30,
      enabled: true,
    });

    expect(added.scheduleStatus).toBe("scheduled");
    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ title: "New reminder" }),
      })
    );
    expect(await storedNotifications()).toEqual([
      expect.objectContaining({ id: "a", enabled: false, scheduleStatus: "disabled" }),
      expect.objectContaining({ title: "New reminder", scheduleStatus: "scheduled" }),
    ]);
    expect((await storedNotifications())[0]).not.toHaveProperty("pendingAction");
  });

  it("resolves a failed delete before editing another reminder and never re-schedules the tombstone", async () => {
    await AsyncStorage.setItem(
      "notificationsList",
      JSON.stringify([
        { ...reminder("a"), scheduledId: "scheduled-a", scheduleStatus: "scheduled" },
        { ...reminder("b"), scheduledId: "scheduled-b", scheduleStatus: "scheduled" },
      ])
    );
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "scheduled-a", content: { data: { type: "mood-reminder" } } },
      { identifier: "scheduled-b", content: { data: { type: "mood-reminder" } } },
    ]);
    notificationMocks.cancelScheduledNotificationAsync.mockRejectedValueOnce(
      new Error("cancel unavailable")
    );
    const { deleteNotification, updateNotification } = await loadService();

    await deleteNotification("a");
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "scheduled-a", content: { data: { type: "mood-reminder" } } },
    ]);
    const result = await updateNotification("b", { title: "Edited B" });

    expect(result.status).toBe("scheduled");
    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: "Edited B",
          data: expect.objectContaining({ notificationId: "b" }),
        }),
      })
    );
    expect(await storedNotifications()).toEqual([
      expect.objectContaining({ id: "b", title: "Edited B", scheduleStatus: "scheduled" }),
    ]);
  });

  it("preserves a batch addition and delete tombstone until cleanup succeeds", async () => {
    await AsyncStorage.setItem(
      "notificationsList",
      JSON.stringify([{ ...reminder("a"), scheduledId: "scheduled-a", scheduleStatus: "scheduled" }])
    );
    notificationMocks.getAllScheduledNotificationsAsync.mockRejectedValueOnce(
      new Error("list unavailable")
    );
    const { ensureMoodReminderScheduled, saveAllNotifications } = await loadService();
    const desired = [{ ...reminder("b"), title: "Desired B" }];

    const result = await saveAllNotifications(desired);

    expect(result.status).toBe("failed");
    expect(await storedNotifications()).toEqual([
      expect.objectContaining({ id: "b", title: "Desired B", scheduleStatus: "failed" }),
      expect.objectContaining({
        id: "a",
        scheduledId: "scheduled-a",
        pendingAction: "delete",
      }),
    ]);

    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "scheduled-a", content: { data: { type: "mood-reminder" } } },
    ]);
    const retry = await ensureMoodReminderScheduled();

    expect(retry?.status).toBe("scheduled");
    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ data: expect.objectContaining({ notificationId: "b" }) }),
      })
    );
    expect(await storedNotifications()).toEqual([
      expect.objectContaining({ id: "b", title: "Desired B", scheduleStatus: "scheduled" }),
    ]);
  });

  it("preserves a legacy settings replacement until native cleanup succeeds", async () => {
    await AsyncStorage.setItem(
      "notificationsList",
      JSON.stringify([{ ...reminder("a"), scheduledId: "scheduled-a", scheduleStatus: "scheduled" }])
    );
    notificationMocks.getAllScheduledNotificationsAsync.mockRejectedValueOnce(
      new Error("list unavailable")
    );
    const { ensureMoodReminderScheduled, saveNotificationSettings } = await loadService();

    const status = await saveNotificationSettings(true, 9, 45);

    expect(status).toBe("failed");
    expect(await storedNotifications()).toEqual([
      expect.objectContaining({
        id: "legacy-single",
        hour: 9,
        minute: 45,
        enabled: true,
        scheduleStatus: "failed",
      }),
      expect.objectContaining({
        id: "a",
        scheduledId: "scheduled-a",
        pendingAction: "delete",
      }),
    ]);

    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "scheduled-a", content: { data: { type: "mood-reminder" } } },
    ]);
    const retry = await ensureMoodReminderScheduled();

    expect(retry?.status).toBe("scheduled");
    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: expect.objectContaining({ notificationId: "legacy-single" }),
        }),
        trigger: expect.objectContaining({ hour: 9, minute: 45 }),
      })
    );
  });

  it("strictly classifies mood reminder responses and derives stable identities", async () => {
    const { getNotificationResponseIdentity, isMoodReminderResponse } = await loadService();
    const moodResponse: unknown = {
      actionIdentifier: "default",
      notification: {
        date: 123,
        request: {
          identifier: "daily-reminder",
          content: { data: { type: "mood-reminder" } },
        },
      },
    };

    expect(isMoodReminderResponse(moodResponse)).toBe(true);
    if (!isMoodReminderResponse(moodResponse)) {
      throw new Error("Expected a mood reminder response");
    }
    expect(getNotificationResponseIdentity(moodResponse)).toBe(
      "daily-reminder:123:default"
    );
    expect(isMoodReminderResponse({
      notification: { request: { content: { title: "How are you feeling?" } } },
    })).toBe(false);
    expect(isMoodReminderResponse({
      notification: { request: { content: { data: { type: "mood-reminders" } } } },
    })).toBe(false);
  });

  it("serializes concurrent read-modify-write operations without losing reminders", async () => {
    const firstSchedule = (() => {
      let resolve!: (id: string) => void;
      const promise = new Promise<string>((nextResolve) => { resolve = nextResolve; });
      return { promise, resolve };
    })();
    notificationMocks.scheduleNotificationAsync
      .mockReturnValueOnce(firstSchedule.promise)
      .mockImplementation(async (payload) => `scheduled-${payload.content.data.notificationId}`);
    const { addNotification } = await loadService();

    const firstAdd = addNotification({
      title: "First",
      body: "Check in",
      hour: 8,
      minute: 0,
      enabled: true,
    });
    const secondAdd = addNotification({
      title: "Second",
      body: "Check in",
      hour: 20,
      minute: 0,
      enabled: true,
    });
    await vi.waitFor(() => {
      expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    });

    firstSchedule.resolve("scheduled-first");
    await Promise.all([firstAdd, secondAdd]);

    const stored = await storedNotifications();
    expect(stored).toHaveLength(2);
    expect(stored.map((item: { title: string }) => item.title)).toEqual(["First", "Second"]);
  });

  it("continues queued mutations after an earlier mutation rejects", async () => {
    const { addNotification, updateNotification } = await loadService();

    const failedUpdate = updateNotification("missing", { title: "Missing" });
    const added = addNotification({
      title: "Still added",
      body: "Check in",
      hour: 12,
      minute: 30,
      enabled: true,
    });

    await expect(failedUpdate).rejects.toThrow("not found");
    await expect(added).resolves.toEqual(expect.objectContaining({ title: "Still added" }));
    expect(await storedNotifications()).toEqual([
      expect.objectContaining({ title: "Still added", scheduleStatus: "scheduled" }),
    ]);
  });
});
