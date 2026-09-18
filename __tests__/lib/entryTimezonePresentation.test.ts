import { afterEach, describe, expect, it } from "vitest";

import { getMoodItemLabel } from "@/constants/accessibility";
import {
  getEntryLocalDateLabel,
  getEntryLocalDateParts,
  getEntryLocalDayKey,
  getEntryLocalTimeLabel,
} from "@/lib/entryTimezone";

const timestamp = Date.parse("2026-03-31T23:30:00Z");

afterEach(() => {
  delete process.env.TZ;
});

describe("recorded entry time presentation", () => {
  it("keeps cross-midnight recorded wall-clock parts for positive, negative, and half-hour offsets", () => {
    expect(getEntryLocalDateParts({ timestamp, utcOffsetMinutes: -120 })).toEqual({
      year: 2026,
      month: 3,
      day: 1,
      hour: 1,
      minute: 30,
      second: 0,
      millisecond: 0,
    });
    expect(getEntryLocalDateParts({ timestamp, utcOffsetMinutes: 420 })).toEqual({
      year: 2026,
      month: 2,
      day: 31,
      hour: 16,
      minute: 30,
      second: 0,
      millisecond: 0,
    });
    expect(getEntryLocalDateParts({ timestamp, utcOffsetMinutes: -345 })).toEqual({
      year: 2026,
      month: 3,
      day: 1,
      hour: 5,
      minute: 15,
      second: 0,
      millisecond: 0,
    });
  });

  it("keeps recorded labels stable when the device timezone changes", () => {
    process.env.TZ = "Pacific/Kiritimati";
    const first = [
      getEntryLocalDateLabel({ timestamp, utcOffsetMinutes: -120 }),
      getEntryLocalTimeLabel({ timestamp, utcOffsetMinutes: -120 }),
    ];

    process.env.TZ = "America/Los_Angeles";
    const second = [
      getEntryLocalDateLabel({ timestamp, utcOffsetMinutes: -120 }),
      getEntryLocalTimeLabel({ timestamp, utcOffsetMinutes: -120 }),
    ];

    expect(second).toEqual(first);
  });

  it("uses the current device timezone only for legacy entries without an offset", () => {
    process.env.TZ = "Pacific/Kiritimati";
    const first = getEntryLocalDateParts({ timestamp, utcOffsetMinutes: null });
    process.env.TZ = "America/Los_Angeles";
    const second = getEntryLocalDateParts({ timestamp, utcOffsetMinutes: null });

    expect(first).not.toEqual(second);
  });

  it("keeps unknown timestamps unknown and never substitutes the current date", () => {
    const invalid = { timestamp: Number.NaN, utcOffsetMinutes: null };
    expect(getEntryLocalDateLabel(invalid)).toBe("Unknown date");
    expect(getEntryLocalTimeLabel(invalid)).toBe("Unknown time");
    expect(getEntryLocalDateParts(invalid)).toBeNull();

    const epoch = { timestamp: 0, utcOffsetMinutes: null };
    expect(getEntryLocalDateLabel(epoch)).toBe("Unknown date");
    expect(getEntryLocalTimeLabel(epoch)).toBe("Unknown time");
    expect(getEntryLocalDateParts(epoch)).toBeNull();
    expect(getEntryLocalDayKey(epoch)).toBeNull();
    expect(getMoodItemLabel(5, "Neutral", "Unknown date", "Unknown time")).toContain(
      "Unknown date at Unknown time",
    );
    expect(getEntryLocalDateParts({ timestamp: Number.POSITIVE_INFINITY, utcOffsetMinutes: null })).toBeNull();
  });

  it("uses the same canonical labels for the history accessibility announcement", () => {
    const entry = { timestamp, utcOffsetMinutes: -120 };
    const date = getEntryLocalDateLabel(entry);
    const time = getEntryLocalTimeLabel(entry);

    expect(getMoodItemLabel(5, "Neutral", date, time)).toBe(
      `Mood entry: Neutral (5), logged on ${date} at ${time}`,
    );
  });
});
