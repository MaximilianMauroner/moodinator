import { describe, expect, it } from "vitest";

import {
  getReminderScheduleResultWarning,
  getReminderScheduleWarning,
} from "../../src/lib/reminderSchedulePresentation";

describe("reminderSchedulePresentation", () => {
  it("does not show warnings for paused or scheduled reminders", () => {
    expect(
      getReminderScheduleWarning({
        enabled: false,
        scheduleStatus: "permission-denied",
        unscheduledReason: "Permission denied",
      })
    ).toBeNull();
    expect(
      getReminderScheduleWarning({
        enabled: true,
        scheduleStatus: "scheduled",
        unscheduledReason: null,
      })
    ).toBeNull();
  });

  it("shows the persisted unscheduled reason for enabled reminders", () => {
    expect(
      getReminderScheduleWarning({
        enabled: true,
        scheduleStatus: "permission-denied",
        unscheduledReason: "Notification permission was not granted.",
      })
    ).toEqual({
      title: "Reminder Not Scheduled",
      message: "Notification permission was not granted.",
    });
  });

  it("shows cleanup failures for paused reminders with a pending action", () => {
    expect(
      getReminderScheduleWarning({
        enabled: false,
        pendingAction: "delete",
        scheduleStatus: "failed",
        unscheduledReason: "Could not confirm cancellation.",
      })
    ).toEqual({
      title: "Reminder Not Scheduled",
      message: "Could not confirm cancellation.",
    });
  });

  it("shows result warnings after failed schedule attempts", () => {
    expect(
      getReminderScheduleResultWarning({
        status: "failed",
        message: "OS rejected reminder.",
      })
    ).toEqual({
      title: "Reminder Not Scheduled",
      message: "OS rejected reminder.",
    });
    expect(getReminderScheduleResultWarning({ status: "scheduled" })).toBeNull();
  });
});
