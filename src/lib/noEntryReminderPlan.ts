export const NO_ENTRY_REMINDER_ID_PREFIX = "no-entry-";
export const NO_ENTRY_REMINDER_HORIZON_DAYS = 14;

export type NoEntryReminderRequest = {
  identifier: string;
  dayKey: string;
  fireAt: number;
};

export type OrdinaryReminderForPlan = {
  hour: number;
  minute: number;
  /** Expo weekday numbering: Sunday = 1, Saturday = 7. Omitted means daily. */
  weekdays?: readonly number[];
  enabled: boolean;
  scheduleStatus?: string;
};

export type NoEntryReminderPlanInput = {
  now: number;
  hour: number;
  minute: number;
  entryTimestamps: readonly number[];
  ordinaryReminders: readonly OrdinaryReminderForPlan[];
  /** Remaining OS request slots, after accounting for other notifications. */
  capacity?: number;
};

export type NoEntryReminderPlan = {
  requests: NoEntryReminderRequest[];
  /** Inclusive calendar bounds, even when entries/collisions leave no requests. */
  horizonStartDayKey: string;
  horizonEndDayKey: string;
  capacity: number;
  /** True only when eligible requests were omitted because capacity ran out. */
  capacityLimited: boolean;
};

function assertTimestamp(timestamp: number): void {
  if (!Number.isFinite(timestamp) || !Number.isFinite(new Date(timestamp).getTime())) {
    throw new RangeError("Reminder timestamps must be valid finite dates.");
  }
}

function isValidTime(hour: number, minute: number): boolean {
  return Number.isInteger(hour) && hour >= 0 && hour <= 23
    && Number.isInteger(minute) && minute >= 0 && minute <= 59;
}

/** A timestamp's calendar date in the device's current timezone. */
export function getLocalDayKey(timestamp: number): string {
  assertTimestamp(timestamp);
  const date = new Date(timestamp);
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function isScheduledCollision(
  reminder: OrdinaryReminderForPlan,
  hour: number,
  minute: number,
  weekday: number,
): boolean {
  if (!reminder.enabled || reminder.scheduleStatus !== "scheduled"
    || !isValidTime(reminder.hour, reminder.minute)
    || reminder.hour !== hour || reminder.minute !== minute) {
    return false;
  }
  const days = reminder.weekdays;
  if (days === undefined) return true;
  // Invalid ordinary records cannot establish that a colliding request exists.
  return days.length > 0
    && days.every((day) => Number.isInteger(day) && day >= 1 && day <= 7)
    && days.includes(weekday);
}

/**
 * Plan today plus the next 13 local calendar dates. Call again after entry
 * mutations, resume, date/timezone changes, or changes to ordinary reminders.
 * These are one-shot requests: the OS cannot query the DB at delivery time.
 */
export function createNoEntryReminderPlan(input: NoEntryReminderPlanInput): NoEntryReminderPlan {
  assertTimestamp(input.now);
  if (!isValidTime(input.hour, input.minute)) {
    throw new RangeError("Reminder time must use an integer hour 0–23 and minute 0–59.");
  }
  const requestedCapacity = input.capacity ?? NO_ENTRY_REMINDER_HORIZON_DAYS;
  if (!Number.isInteger(requestedCapacity) || requestedCapacity < 0) {
    throw new RangeError("Reminder capacity must be a non-negative integer.");
  }
  const capacity = Math.min(requestedCapacity, NO_ENTRY_REMINDER_HORIZON_DAYS);
  const entryDays = new Set(input.entryTimestamps.map(getLocalDayKey));
  const day = new Date(input.now);
  day.setHours(0, 0, 0, 0);
  const horizonStartDayKey = getLocalDayKey(day.getTime());
  const requests: NoEntryReminderRequest[] = [];
  let horizonEndDayKey = horizonStartDayKey;
  let capacityLimited = false;

  for (let index = 0; index < NO_ENTRY_REMINDER_HORIZON_DAYS; index += 1) {
    const dayKey = getLocalDayKey(day.getTime());
    horizonEndDayKey = dayKey;
    const fireDate = new Date(day);
    // Calendar arithmetic preserves the chosen wall-clock time across DST.
    // For a skipped/repeated clock time, Date uses the platform's gap/fold rule.
    fireDate.setHours(input.hour, input.minute, 0, 0);
    const fireAt = fireDate.getTime();
    assertTimestamp(fireAt);
    const collides = input.ordinaryReminders.some((reminder) =>
      isScheduledCollision(reminder, input.hour, input.minute, day.getDay() + 1),
    );
    if (fireAt > input.now && !entryDays.has(dayKey) && !collides) {
      if (requests.length < capacity) {
        requests.push({ identifier: `${NO_ENTRY_REMINDER_ID_PREFIX}${dayKey}`, dayKey, fireAt });
      } else {
        capacityLimited = true;
      }
    }
    day.setDate(day.getDate() + 1);
  }

  return { requests, horizonStartDayKey, horizonEndDayKey, capacity, capacityLimited };
}
