import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createNoEntryReminderPlan,
  getLocalDayKey,
  type NoEntryReminderPlanInput,
} from "../../src/lib/noEntryReminderPlan";

const originalTimeZone = process.env.TZ;

beforeEach(() => {
  process.env.TZ = "UTC";
});

afterEach(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});

function plan(overrides: Partial<NoEntryReminderPlanInput> = {}) {
  return createNoEntryReminderPlan({
    now: Date.parse("2026-09-26T08:00:00Z"),
    hour: 20,
    minute: 15,
    entryTimestamps: [],
    ordinaryReminders: [],
    ...overrides,
  });
}

function dayKeys(overrides: Partial<NoEntryReminderPlanInput> = {}) {
  return plan(overrides).requests.map((request) => request.dayKey);
}

describe("no-entry reminder plan", () => {
  it("uses 14 calendar dates and stable unique identifiers, without backfill", () => {
    const result = plan();
    expect(result.horizonStartDayKey).toBe("2026-09-26");
    expect(result.horizonEndDayKey).toBe("2026-10-09");
    expect(result.requests).toHaveLength(14);
    expect(new Set(result.requests.map((request) => request.identifier)).size).toBe(14);
    expect(result.requests[0]).toEqual({
      identifier: "no-entry-2026-09-26",
      dayKey: "2026-09-26",
      fireAt: Date.parse("2026-09-26T20:15:00Z"),
    });
    expect(plan({ now: Date.parse("2026-09-26T09:00:00Z") }).requests).toEqual(result.requests);
    expect(result.capacityLimited).toBe(false);
  });

  it.each(["20:15:00", "20:15:01", "23:59:59"])("does not queue today at/after its time (%s)", (time) => {
    const result = plan({ now: Date.parse(`2026-09-26T${time}Z`) });
    expect(result.requests).toHaveLength(13);
    expect(result.requests[0].dayKey).toBe("2026-09-27");
    expect(result.horizonEndDayKey).toBe("2026-10-09");
  });

  it("counts any entry inside the local day, including later entries, and excludes adjacent days", () => {
    process.env.TZ = "Asia/Kolkata";
    const now = Date.parse("2026-09-26T02:30:00Z");
    const beforeMidnight = Date.parse("2026-09-25T18:29:59.999Z");
    const midnight = Date.parse("2026-09-25T18:30:00Z");
    const endOfDay = Date.parse("2026-09-26T18:29:59.999Z");
    const tomorrow = Date.parse("2026-09-26T18:30:00Z");
    expect(getLocalDayKey(beforeMidnight)).toBe("2026-09-25");
    expect(getLocalDayKey(midnight)).toBe("2026-09-26");
    expect(dayKeys({ now, entryTimestamps: [beforeMidnight, tomorrow] })).toContain("2026-09-26");
    expect(dayKeys({ now, entryTimestamps: [midnight] })).not.toContain("2026-09-26");
    expect(dayKeys({ now, entryTimestamps: [endOfDay] })).not.toContain("2026-09-26");
    expect(dayKeys({ now, entryTimestamps: [tomorrow] })).not.toContain("2026-09-27");
  });

  it("recomputes after save, final-entry deletion, and local date rollover", () => {
    const entry = Date.parse("2026-09-26T08:01:00Z");
    expect(dayKeys({ entryTimestamps: [entry] })).not.toContain("2026-09-26");
    expect(dayKeys({ entryTimestamps: [] })).toContain("2026-09-26");
    expect(dayKeys({ entryTimestamps: [entry, entry + 1] })).not.toContain("2026-09-26");
    const nextDay = plan({ now: Date.parse("2026-09-27T00:00:00Z"), entryTimestamps: [entry] });
    expect(nextDay.requests[0].dayKey).toBe("2026-09-27");
    expect(nextDay.horizonEndDayKey).toBe("2026-10-10");
  });

  it("suppresses only actual ordinary schedules at the same time and weekday (Sunday = 1)", () => {
    const ordinary = { hour: 20, minute: 15, enabled: true, scheduleStatus: "scheduled" };
    const result = dayKeys({ ordinaryReminders: [{ ...ordinary, weekdays: [1, 7] }] });
    expect(result).not.toContain("2026-09-26"); // Saturday
    expect(result).not.toContain("2026-09-27"); // Sunday
    expect(result).toContain("2026-09-28");
    expect(plan({ ordinaryReminders: [ordinary] }).requests).toEqual([]);
    expect(plan({ ordinaryReminders: [ordinary] }).capacityLimited).toBe(false);
    expect(plan({ ordinaryReminders: [{ ...ordinary, minute: 16 }] }).requests).toHaveLength(14);
  });

  it.each([undefined, "permission-denied", "unavailable", "failed", "partial-failure", "disabled"])(
    "does not let an unscheduled ordinary reminder (%s) suppress a prompt",
    (scheduleStatus) => {
      expect(plan({ ordinaryReminders: [{ hour: 20, minute: 15, enabled: true, scheduleStatus }] }).requests).toHaveLength(14);
    },
  );

  it("ignores disabled or malformed ordinary schedules", () => {
    const ordinary = { hour: 20, minute: 15, enabled: true, scheduleStatus: "scheduled" };
    expect(plan({ ordinaryReminders: [{ ...ordinary, enabled: false }] }).requests).toHaveLength(14);
    for (const weekdays of [[], [0], [8], [1.5], [1, Number.NaN], [1, 8]]) {
      expect(plan({ ordinaryReminders: [{ ...ordinary, weekdays }] }).requests).toHaveLength(14);
    }
  });

  it("bounds capacity and reports eligible requests omitted by capacity", () => {
    const result = plan({ capacity: 2, entryTimestamps: [Date.parse("2026-09-27T08:00:00Z")] });
    expect(result.requests.map((request) => request.dayKey)).toEqual(["2026-09-26", "2026-09-28"]);
    expect(result.capacityLimited).toBe(true);
    expect(result.horizonEndDayKey).toBe("2026-10-09");
    expect(plan({ capacity: 0 })).toMatchObject({ requests: [], capacity: 0, capacityLimited: true });
    expect(plan({ capacity: 100 })).toMatchObject({ capacity: 14, capacityLimited: false });
    expect(plan({ capacity: 100 }).requests).toHaveLength(14);
    expect(plan({ capacity: 13, now: Date.parse("2026-09-26T23:00:00Z") }).capacityLimited).toBe(false);
  });

  it.each([
    ["2026-03-28T08:00:00Z", 23],
    ["2026-10-24T08:00:00Z", 25],
  ])("preserves wall-clock time across Vienna DST from %s", (now, intervalHours) => {
    process.env.TZ = "Europe/Vienna";
    const result = plan({ now: Date.parse(now) });
    expect(result.requests).toHaveLength(14);
    for (const request of result.requests) {
      const date = new Date(request.fireAt);
      expect([date.getHours(), date.getMinutes()]).toEqual([20, 15]);
    }
    expect(result.requests[1].fireAt - result.requests[0].fireAt).toBe(intervalHours * 60 * 60 * 1000);
  });

  it("uses one request for a repeated time and Date's forward shift for a missing time", () => {
    process.env.TZ = "Europe/Vienna";
    const spring = plan({ now: Date.parse("2026-03-29T00:00:00Z"), hour: 2, minute: 30 });
    expect(spring.requests[0].fireAt).toBe(Date.parse("2026-03-29T01:30:00Z"));
    expect(new Date(spring.requests[1].fireAt).getHours()).toBe(2);
    const fall = plan({ now: Date.parse("2026-10-24T23:00:00Z"), hour: 2, minute: 30 });
    expect(fall.requests[0].fireAt).toBe(Date.parse("2026-10-25T00:30:00Z"));
    expect(fall.requests.filter((request) => request.dayKey === "2026-10-25")).toHaveLength(1);
    expect(dayKeys({ now: Date.parse("2026-10-25T01:00:00Z"), hour: 2, minute: 30 })).not.toContain("2026-10-25");
  });

  it("reinterprets entry dates and chosen time in the current device timezone", () => {
    const now = Date.parse("2026-09-26T02:00:00Z");
    const entryTimestamps = [Date.parse("2026-09-25T23:30:00Z")];
    expect(dayKeys({ now, entryTimestamps })).toContain("2026-09-26");
    process.env.TZ = "Asia/Kolkata";
    expect(dayKeys({ now, entryTimestamps })).not.toContain("2026-09-26");
    expect(plan({ now }).requests[0].fireAt).toBe(Date.parse("2026-09-26T14:45:00Z"));
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 8.64e15 + 1])("rejects invalid timestamps (%s)", (timestamp) => {
    expect(() => getLocalDayKey(timestamp)).toThrow(RangeError);
    expect(() => plan({ now: timestamp })).toThrow(RangeError);
    expect(() => plan({ entryTimestamps: [timestamp] })).toThrow(RangeError);
  });

  it.each([-1, 24, 1.5, Number.NaN])("rejects invalid hours (%s)", (hour) => {
    expect(() => plan({ hour })).toThrow(RangeError);
  });

  it.each([-1, 60, 1.5, Number.POSITIVE_INFINITY])("rejects invalid minutes (%s)", (minute) => {
    expect(() => plan({ minute })).toThrow(RangeError);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid capacities (%s)", (capacity) => {
    expect(() => plan({ capacity })).toThrow(RangeError);
  });
});
