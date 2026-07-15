import type {
  NotificationConfig,
  ReminderScheduleResult,
  ReminderScheduleStatus,
} from "@/services/notificationService";

export type ReminderScheduleWarning = {
  title: "Reminder Not Scheduled";
  message: string;
};

const DEFAULT_SCHEDULE_MESSAGES: Record<
  Exclude<ReminderScheduleStatus, "scheduled" | "disabled">,
  string
> = {
  "permission-denied": "Notification permission is not enabled for Moodinator.",
  unavailable: "Notifications are unavailable on this device.",
  failed: "Moodinator could not schedule this reminder.",
  "partial-failure": "One or more reminders could not be scheduled.",
};

function isUnscheduledStatus(
  status: ReminderScheduleStatus | undefined
): status is Exclude<ReminderScheduleStatus, "scheduled" | "disabled"> {
  return (
    status === "permission-denied" ||
    status === "unavailable" ||
    status === "failed" ||
    status === "partial-failure"
  );
}

export function getReminderScheduleWarning(
  notification: Pick<
    NotificationConfig,
    "enabled" | "scheduleStatus" | "unscheduledReason"
  >
): ReminderScheduleWarning | null {
  if (!notification.enabled || !isUnscheduledStatus(notification.scheduleStatus)) {
    return null;
  }

  return {
    title: "Reminder Not Scheduled",
    message:
      notification.unscheduledReason ||
      DEFAULT_SCHEDULE_MESSAGES[notification.scheduleStatus],
  };
}

export function getReminderScheduleResultWarning(
  result: Pick<ReminderScheduleResult, "status" | "message">
): ReminderScheduleWarning | null {
  if (!isUnscheduledStatus(result.status)) {
    return null;
  }

  return {
    title: "Reminder Not Scheduled",
    message: result.message || DEFAULT_SCHEDULE_MESSAGES[result.status],
  };
}
