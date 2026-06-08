import { describe, expect, test } from "vitest";
import { getHomeHeaderSnapTarget } from "../../src/lib/homeHeaderSnap";

const baseMetrics = {
  contentHeight: 1000,
  viewportHeight: 500,
  collapseDistance: 200,
};

describe("getHomeHeaderSnapTarget", () => {
  test("snaps offsets below the midpoint back to expanded", () => {
    expect(getHomeHeaderSnapTarget({ ...baseMetrics, offsetY: 80 })).toBe(0);
  });

  test("snaps offsets at or above the midpoint to collapsed", () => {
    expect(getHomeHeaderSnapTarget({ ...baseMetrics, offsetY: 100 })).toBe(
      200
    );
    expect(getHomeHeaderSnapTarget({ ...baseMetrics, offsetY: 120 })).toBe(
      200
    );
  });

  test("does not snap at the exact top", () => {
    expect(getHomeHeaderSnapTarget({ ...baseMetrics, offsetY: 0 })).toBeNull();
  });

  test("does not snap during negative top overscroll", () => {
    expect(getHomeHeaderSnapTarget({ ...baseMetrics, offsetY: -24 })).toBeNull();
  });

  test("does not snap when already collapsed or deeper in the list", () => {
    expect(getHomeHeaderSnapTarget({ ...baseMetrics, offsetY: 200 })).toBeNull();
    expect(getHomeHeaderSnapTarget({ ...baseMetrics, offsetY: 360 })).toBeNull();
  });

  test("snaps expanded when content cannot scroll far enough to fully collapse", () => {
    expect(
      getHomeHeaderSnapTarget({
        offsetY: 150,
        contentHeight: 600,
        viewportHeight: 500,
        collapseDistance: 200,
      })
    ).toBe(0);
  });

  test("uses epsilon to avoid tiny snap corrections near targets", () => {
    expect(getHomeHeaderSnapTarget({ ...baseMetrics, offsetY: 0.25 })).toBeNull();
    expect(
      getHomeHeaderSnapTarget({ ...baseMetrics, offsetY: 199.75 })
    ).toBeNull();
  });
});
