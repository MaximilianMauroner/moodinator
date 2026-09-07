import React from "react";
import { Text } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCountUp } from "@/hooks/useCountUp";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { motion } from "@/constants/motion";

const accessibility = vi.hoisted(() => ({
  isReduceMotionEnabled: vi.fn(async () => false),
  listeners: new Set<(enabled: boolean) => void>(),
  remove: vi.fn(),
}));

const reanimated = vi.hoisted(() => ({ reducedMotion: false }));

vi.mock("react-native-reanimated", () => ({
  useReducedMotion: () => reanimated.reducedMotion,
}));

vi.mock("react-native", () => ({
  Text: "Text",
  AccessibilityInfo: {
    isReduceMotionEnabled: accessibility.isReduceMotionEnabled,
    addEventListener: (_event: string, handler: (enabled: boolean) => void) => {
      accessibility.listeners.add(handler);
      return {
        remove: () => {
          accessibility.listeners.delete(handler);
          accessibility.remove();
        },
      };
    },
  },
}));

/** Drives requestAnimationFrame by hand so a reveal can be stepped frame by frame. */
function createFrameClock() {
  let pending: ((timestamp: number) => void) | null = null;
  let nextId = 1;

  vi.stubGlobal("requestAnimationFrame", (callback: (timestamp: number) => void) => {
    pending = callback;
    return nextId++;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    pending = null;
  });

  return {
    hasPending: () => pending !== null,
    async advanceTo(timestamp: number) {
      const callback = pending;
      pending = null;
      if (callback) await act(async () => callback(timestamp));
    },
  };
}

let renderer: ReactTestRenderer;
let clock: ReturnType<typeof createFrameClock>;

function Metric({ value, decimals }: { decimals?: number; value: number }) {
  const displayed = useCountUp(value, decimals);
  return <Text testID="metric">{displayed.toFixed(decimals ?? 0)}</Text>;
}

function Probe() {
  const reduced = useReducedMotion();
  return <Text testID="probe">{String(reduced)}</Text>;
}

function readText(testID: string) {
  return renderer.root.findByProps({ testID }).props.children;
}

async function render(element: React.ReactElement) {
  await act(async () => {
    renderer = create(element);
  });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  accessibility.listeners.clear();
  accessibility.isReduceMotionEnabled.mockResolvedValue(false);
  reanimated.reducedMotion = false;
  clock = createFrameClock();
});

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.unstubAllGlobals();
});

describe("useReducedMotion", () => {
  it("reports the platform setting and follows later changes", async () => {
    reanimated.reducedMotion = true;
    accessibility.isReduceMotionEnabled.mockResolvedValue(true);
    await render(<Probe />);

    expect(readText("probe")).toBe("true");

    await act(async () => {
      accessibility.listeners.forEach((handler) => handler(false));
    });
    expect(readText("probe")).toBe("false");
  });

  it("keeps motion enabled when the platform cannot answer", async () => {
    accessibility.isReduceMotionEnabled.mockRejectedValue(new Error("unsupported"));
    await render(<Probe />);

    expect(readText("probe")).toBe("false");
  });

  it("removes its subscription on unmount", async () => {
    await render(<Probe />);
    expect(accessibility.listeners.size).toBe(1);

    await act(async () => renderer.unmount());
    expect(accessibility.listeners.size).toBe(0);
  });
});

describe("useCountUp", () => {
  it("counts from zero to the final value and then stops", async () => {
    await render(<Metric value={4.2} decimals={1} />);

    expect(readText("metric")).toBe("0.0");

    await clock.advanceTo(0);
    await clock.advanceTo(motion.duration.reveal / 2);
    const midway = Number(readText("metric"));
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(4.2);

    await clock.advanceTo(motion.duration.reveal);
    expect(readText("metric")).toBe("4.2");
    expect(clock.hasPending()).toBe(false);
  });

  it("returns the final value at once under reduced motion", async () => {
    accessibility.isReduceMotionEnabled.mockResolvedValue(true);
    await render(<Metric value={18} />);

    // No first frame at zero, and no animation is scheduled at all.
    expect(readText("metric")).toBe("18");
    expect(clock.hasPending()).toBe(false);
  });

  it("restarts the reveal when the value changes", async () => {
    await render(<Metric value={6} />);
    await clock.advanceTo(0);
    await clock.advanceTo(motion.duration.reveal);
    expect(readText("metric")).toBe("6");

    await act(async () => {
      renderer.update(<Metric value={10} />);
    });
    await clock.advanceTo(1000);
    expect(Number(readText("metric"))).toBeLessThan(10);

    await clock.advanceTo(1000 + motion.duration.reveal);
    expect(readText("metric")).toBe("10");
  });
});
