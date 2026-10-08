import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidateMoods: vi.fn(),
  withNotificationReset: vi.fn(),
  getNoEntryReminderSettings: vi.fn(),
  saveNoEntryReminderSettings: vi.fn(),
  cancelMoodReminder: vi.fn(),
  cancelAllScheduledNotifications: vi.fn(),
  clearAll: vi.fn(),
}));

vi.mock("@/shared/state/moodsStore", () => ({
  useMoodsStore: { getState: () => ({ invalidate: mocks.invalidateMoods }) },
}));
vi.mock("../../src/services/notificationService", () => ({ notificationService: mocks }));
vi.mock("../../src/services/moodService", () => ({ moodService: { clearAll: mocks.clearAll } }));

import { resetDeveloperAppData } from "../../src/services/developerResetService";
import { NO_ENTRY_REMINDER_SETTINGS_KEY } from "../../src/services/noEntryReminderScheduler";

const disabled = { enabled: false, hour: 21, minute: 0, status: "disabled", retainedIds: [], message: null };

describe("full developer reset", () => {
  const clearPin = vi.fn();
  let resetActive = false;

  beforeEach(async () => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    clearPin.mockReset();
    resetActive = false;
    mocks.withNotificationReset.mockImplementation(async (operation: () => Promise<void>) => {
      resetActive = true;
      try {
        await operation();
      } finally {
        resetActive = false;
      }
    });
    await AsyncStorage.clear();
    await AsyncStorage.setItem("someOtherPreference", "preserve until cleanup succeeds");
    await AsyncStorage.setItem(NO_ENTRY_REMINDER_SETTINGS_KEY, JSON.stringify({
      ...disabled, enabled: true, status: "scheduled", retainedIds: ["no-entry-2026-09-26"],
    }));
    mocks.getNoEntryReminderSettings.mockImplementation(async () =>
      JSON.parse((await AsyncStorage.getItem(NO_ENTRY_REMINDER_SETTINGS_KEY))!),
    );
    mocks.saveNoEntryReminderSettings.mockImplementation(async () => {
      await AsyncStorage.setItem(NO_ENTRY_REMINDER_SETTINGS_KEY, JSON.stringify(disabled));
      return disabled;
    });
    mocks.cancelMoodReminder.mockResolvedValue({ status: "disabled" });
  });

  it("disables reminders before clearing moods, so post-commit reconciliation cannot recreate requests", async () => {
    const events: string[] = [];
    let nativeRequestCount = 14;
    mocks.cancelAllScheduledNotifications.mockImplementation(async () => {
      events.push("native cleanup");
      nativeRequestCount = 0;
    });
    clearPin.mockImplementation(async () => { events.push("clear PIN"); });
    mocks.clearAll.mockImplementation(async () => {
      events.push("clear moods");
      // Reproduce clearAll's post-commit decision using the persisted choice.
      const settings = JSON.parse((await AsyncStorage.getItem(NO_ENTRY_REMINDER_SETTINGS_KEY))!);
      if (settings.enabled) nativeRequestCount = 14;
      expect(settings.enabled).toBe(false);
      expect(await AsyncStorage.getItem("someOtherPreference")).not.toBeNull();
    });

    await resetDeveloperAppData(clearPin);

    expect(mocks.withNotificationReset).toHaveBeenCalledTimes(1);
    expect(resetActive).toBe(false);
    expect(mocks.saveNoEntryReminderSettings).toHaveBeenCalledWith({ enabled: false, hour: 21, minute: 0 });
    expect(mocks.cancelMoodReminder).toHaveBeenCalledTimes(1);
    expect(events).toEqual(["native cleanup", "clear PIN", "clear moods"]);
    expect(nativeRequestCount).toBe(0);
    expect(await AsyncStorage.getItem(NO_ENTRY_REMINDER_SETTINGS_KEY)).toBeNull();
    expect(await AsyncStorage.getItem("someOtherPreference")).toBeNull();
  });

  it("keeps the exclusion active from initial reminder reads through final preference clearing", async () => {
    const initialRead = mocks.getNoEntryReminderSettings.getMockImplementation()!;
    mocks.getNoEntryReminderSettings.mockImplementation(async () => {
      expect(resetActive).toBe(true);
      return initialRead();
    });
    mocks.withNotificationReset.mockImplementation(async (operation: () => Promise<void>) => {
      resetActive = true;
      try {
        await operation();
        expect(await AsyncStorage.getItem(NO_ENTRY_REMINDER_SETTINGS_KEY)).toBeNull();
        expect(await AsyncStorage.getItem("someOtherPreference")).toBeNull();
      } finally {
        resetActive = false;
      }
    });
    let releasePin!: () => void;
    let enteredPin!: () => void;
    const pinEntered = new Promise<void>((resolve) => { enteredPin = resolve; });
    const pinRelease = new Promise<void>((resolve) => { releasePin = resolve; });
    clearPin.mockImplementation(async () => {
      enteredPin();
      await pinRelease;
    });
    mocks.clearAll.mockImplementation(async () => { expect(resetActive).toBe(true); });

    const reset = resetDeveloperAppData(clearPin);
    await pinEntered;
    expect(resetActive).toBe(true);
    expect(mocks.cancelAllScheduledNotifications).toHaveBeenCalledTimes(1);
    expect(mocks.clearAll).not.toHaveBeenCalled();
    releasePin();
    await reset;
    expect(resetActive).toBe(false);
  });

  it("does not start cleanup when notification reset exclusion cannot be acquired", async () => {
    mocks.withNotificationReset.mockRejectedValue(new Error("Reset already in progress"));

    await expect(resetDeveloperAppData(clearPin)).rejects.toThrow("Reset already in progress");

    expect(mocks.getNoEntryReminderSettings).not.toHaveBeenCalled();
    expect(clearPin).not.toHaveBeenCalled();
    expect(mocks.clearAll).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem("someOtherPreference")).not.toBeNull();
  });

  it.each([
    { ...disabled, status: "failed", retainedIds: ["no-entry-2026-09-26"], message: "Cancellation failed" },
    { ...disabled, status: "unavailable", message: "Native notifications unavailable" },
    { ...disabled, retainedIds: ["no-entry-2026-09-26"], message: "Cleanup still pending" },
  ])("preserves reset data and cleanup state when conditional cleanup is incomplete ($status)", async (result) => {
    mocks.saveNoEntryReminderSettings.mockImplementation(async () => {
      await AsyncStorage.setItem(NO_ENTRY_REMINDER_SETTINGS_KEY, JSON.stringify(result));
      return result;
    });

    await expect(resetDeveloperAppData(clearPin)).rejects.toThrow(result.message!);

    expect(resetActive).toBe(false);
    expect(JSON.parse((await AsyncStorage.getItem(NO_ENTRY_REMINDER_SETTINGS_KEY))!)).toEqual(result);
    expect(await AsyncStorage.getItem("someOtherPreference")).not.toBeNull();
    expect(mocks.cancelMoodReminder).not.toHaveBeenCalled();
    expect(mocks.cancelAllScheduledNotifications).not.toHaveBeenCalled();
    expect(clearPin).not.toHaveBeenCalled();
    expect(mocks.clearAll).not.toHaveBeenCalled();
  });

  it("preserves preferences and data when ordinary reminder cleanup fails", async () => {
    mocks.cancelMoodReminder.mockResolvedValue({ status: "failed", message: "Ordinary cleanup failed" });

    await expect(resetDeveloperAppData(clearPin)).rejects.toThrow("Ordinary cleanup failed");

    expect(await AsyncStorage.getItem("someOtherPreference")).not.toBeNull();
    expect(await AsyncStorage.getItem(NO_ENTRY_REMINDER_SETTINGS_KEY)).not.toBeNull();
    expect(mocks.cancelAllScheduledNotifications).not.toHaveBeenCalled();
    expect(clearPin).not.toHaveBeenCalled();
    expect(mocks.clearAll).not.toHaveBeenCalled();
  });

  it("preserves preferences and data when final native cleanup cannot be confirmed", async () => {
    mocks.cancelAllScheduledNotifications.mockRejectedValue(new Error("Native cleanup unconfirmed"));

    await expect(resetDeveloperAppData(clearPin)).rejects.toThrow("Native cleanup unconfirmed");

    expect(await AsyncStorage.getItem("someOtherPreference")).not.toBeNull();
    expect(await AsyncStorage.getItem(NO_ENTRY_REMINDER_SETTINGS_KEY)).not.toBeNull();
    expect(clearPin).not.toHaveBeenCalled();
    expect(mocks.clearAll).not.toHaveBeenCalled();
  });

  it("retains preferences if clearing the mood database fails", async () => {
    mocks.clearAll.mockRejectedValue(new Error("DB clear failed"));

    await expect(resetDeveloperAppData(clearPin)).rejects.toThrow("DB clear failed");
    expect(resetActive).toBe(false);

    expect(await AsyncStorage.getItem("someOtherPreference")).not.toBeNull();
    expect(await AsyncStorage.getItem(NO_ENTRY_REMINDER_SETTINGS_KEY)).not.toBeNull();
  });

  it("can retry a reset after unsuccessful conditional cleanup", async () => {
    mocks.saveNoEntryReminderSettings.mockResolvedValueOnce({
      ...disabled, status: "failed", retainedIds: ["no-entry-2026-09-26"], message: "Retry cleanup",
    });
    await expect(resetDeveloperAppData(clearPin)).rejects.toThrow("Retry cleanup");

    await expect(resetDeveloperAppData(clearPin)).resolves.toBeUndefined();

    expect(mocks.clearAll).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(NO_ENTRY_REMINDER_SETTINGS_KEY)).toBeNull();
  });
});
