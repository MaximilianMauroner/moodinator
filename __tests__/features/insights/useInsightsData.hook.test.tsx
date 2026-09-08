import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockMoodEntry } from "../../db/mockClient";
import * as streaks from "../../../src/features/insights/utils/streaks";
import { useInsightsData, type InsightsData } from "../../../src/features/insights/hooks/useInsightsData";
import { useMoodsStore } from "../../../src/shared/state/moodsStore";

const native = vi.hoisted(() => ({
  listener: undefined as undefined | ((state: string) => void),
}));
vi.mock("react-native", () => ({
  AppState: {
    addEventListener: vi.fn((_event: string, listener: (state: string) => void) => {
      native.listener = listener;
      return { remove: vi.fn() };
    }),
  },
}));
vi.mock("expo-router", () => ({ useFocusEffect: () => {} }));
vi.mock("@/constants/colors", () => ({ useThemeColors: () => ({ isDark: true }) }));
vi.mock("@/services/moodService", async () => {
  const workflow = await import("../../../src/services/moodEntryWorkflow");
  return { ...workflow, moodService: {} };
});

let renderer: ReactTestRenderer;
let result: InsightsData;
function Harness() {
  result = useInsightsData();
  return null;
}
async function mount() {
  await act(async () => { renderer = create(<Harness />); });
}

describe("useInsightsData hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T12:00:00"));
    useMoodsStore.getState().setLocal([]);
    useMoodsStore.setState({ ensureFresh: vi.fn().mockResolvedValue(undefined) });
  });
  afterEach(async () => {
    if (renderer) await act(async () => { renderer.unmount(); });
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("shows an initial hydration error instead of endless loading", async () => {
    useMoodsStore.setState({ status: "error", error: "read failed", isStale: true });
    await mount();
    expect(result.loading).toBe(false);
    expect(result.error).toBe("read failed");
  });

  it("can reach the month containing the oldest entry from an earlier anchor day", async () => {
    useMoodsStore.getState().setLocal([
      createMockMoodEntry({ timestamp: new Date("2026-08-20T12:00:00").getTime() }),
    ]);
    await mount();
    await act(async () => { result.setPeriod("month"); });
    expect(result.canGoPrevious).toBe(true);
    await act(async () => { result.goToPrevious(); });
    expect(result.periodMoods).toHaveLength(1);
    expect(result.canGoPrevious).toBe(false);
    expect(result.canGoNext).toBe(true);
  });

  it("can reach the week containing the oldest entry", async () => {
    vi.setSystemTime(new Date("2026-09-07T12:00:00"));
    useMoodsStore.getState().setLocal([
      createMockMoodEntry({ timestamp: new Date("2026-09-06T12:00:00").getTime() }),
    ]);
    await mount();
    expect(result.canGoPrevious).toBe(true);
    await act(async () => { result.goToPrevious(); });
    expect(result.periodMoods).toHaveLength(1);
    expect(result.canGoPrevious).toBe(false);
  });

  it("reuses full-history streaks across navigation and recalculates at local midnight", async () => {
    vi.setSystemTime(new Date("2026-09-06T23:59:59"));
    useMoodsStore.getState().setLocal([
      createMockMoodEntry({ timestamp: new Date("2026-09-05T12:00:00").getTime() }),
    ]);
    const calculate = vi.spyOn(streaks, "calculateStreak");
    await mount();
    expect(result.streak.current).toBe(1);
    await act(async () => { result.setPeriod("month"); });
    await act(async () => { result.goToPrevious(); });
    expect(calculate).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(result.streak.current).toBe(0);
    expect(calculate).toHaveBeenCalledTimes(2);
  });

  it("updates the local day when returning from the background", async () => {
    useMoodsStore.getState().setLocal([
      createMockMoodEntry({ timestamp: new Date("2026-09-05T12:00:00").getTime() }),
    ]);
    await mount();
    expect(result.streak.current).toBe(1);
    vi.setSystemTime(new Date("2026-09-08T12:00:00"));
    await act(async () => { native.listener?.("active"); });
    expect(result.streak.current).toBe(0);
  });
});
