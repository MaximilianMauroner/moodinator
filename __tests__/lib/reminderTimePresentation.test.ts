import { describe, expect, it } from "vitest";

import { formatReminderTime } from "../../src/lib/reminderTimePresentation";

describe("formatReminderTime", () => {
  it("uses a 24-hour clock when the device requests it", () => {
    expect(formatReminderTime(20, 5, "en-GB", true)).toBe("20:05");
  });

  it("uses a 12-hour clock when the device requests it", () => {
    expect(formatReminderTime(20, 5, "en-US", false)).toBe("08:05 PM");
  });
});
