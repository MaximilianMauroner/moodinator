import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { analysisStart } from "../../../src/features/insights/utils/analysis";

vi.mock("@/hooks/useColorScheme", () => ({ useColorScheme: () => "dark" }));

const originalTimeZone = process.env.TZ;

beforeEach(() => {
  process.env.TZ = "UTC";
});

afterEach(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});

describe("analysis windows", () => {
  const afternoon = new Date("2026-09-08T15:30:00Z");

  it("starts a numbered range on the first inclusive local day", () => {
    expect(analysisStart("7", afternoon).toISOString()).toBe(
      "2026-09-02T00:00:00.000Z",
    );
    expect(analysisStart("30", afternoon).toISOString()).toBe(
      "2026-08-10T00:00:00.000Z",
    );
    expect(analysisStart("90", afternoon).toISOString()).toBe(
      "2026-06-11T00:00:00.000Z",
    );
    expect(analysisStart("7", new Date("2026-09-08T00:30:00Z")).toISOString()).toBe(
      "2026-09-02T00:00:00.000Z",
    );
  });

  it("uses the older of the oldest entry and now for all history", () => {
    expect(
      analysisStart("all", afternoon, Date.parse("2024-01-15T18:40:00Z")).toISOString(),
    ).toBe("2024-01-15T00:00:00.000Z");
    expect(analysisStart("all", afternoon, null).toISOString()).toBe(
      "2026-09-08T00:00:00.000Z",
    );
    expect(analysisStart("all", afternoon).toISOString()).toBe(
      "2026-09-08T00:00:00.000Z",
    );
    expect(
      analysisStart("all", afternoon, Date.parse("2027-01-01T00:00:00Z")).toISOString(),
    ).toBe("2026-09-08T00:00:00.000Z");
    expect(
      analysisStart("all", afternoon, Date.parse("2026-09-08T22:00:00Z")).toISOString(),
    ).toBe("2026-09-08T00:00:00.000Z");
  });

  it("keeps a seven-day window on calendar dates across the spring-forward", () => {
    process.env.TZ = "America/New_York";
    const start = analysisStart("7", new Date("2026-03-10T15:00:00-04:00"));

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(2);
    expect(start.getDate()).toBe(4);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });
});
