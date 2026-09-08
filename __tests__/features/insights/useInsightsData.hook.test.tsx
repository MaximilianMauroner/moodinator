import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockMoodEntry } from "../../db/mockClient";
import { moodService } from "../../../src/services/moodService";
import * as streaks from "../../../src/features/insights/utils/streaks";
import {
  useInsightsData,
  type InsightsData,
} from "../../../src/features/insights/hooks/useInsightsData";
import { useMoodsStore } from "../../../src/shared/state/moodsStore";

const native = vi.hoisted(() => ({
  listener: undefined as undefined | ((state: string) => void),
}));
vi.mock("react-native", () => ({
  AppState: {
    addEventListener: vi.fn(
      (_event: string, listener: (state: string) => void) => {
        native.listener = listener;
        return { remove: vi.fn() };
      },
    ),
  },
}));
vi.mock("expo-router", () => ({ useFocusEffect: () => {} }));
vi.mock("@/constants/colors", () => ({
  useThemeColors: () => ({ isDark: true }),
}));
vi.mock("@/services/moodService", async () => {
  const workflow = await import("../../../src/services/moodEntryWorkflow");
  return {
    ...workflow,
    moodService: {
      getPaginated: vi.fn(async () => ({
        data: useMoodsStore.getState().moods.slice(0, 14),
        hasMore: false,
        total: useMoodsStore.getState().moods.length,
      })),
      getInRange: vi.fn(
        async (range?: { startDate?: number; endDate?: number }) => {
          const state = useMoodsStore.getState();
          if (state.error) throw new Error(state.error);
          return state.moods.filter(
            (entry) =>
              (!range?.startDate || entry.timestamp >= range.startDate) &&
              (!range?.endDate || entry.timestamp <= range.endDate),
          );
        },
      ),
      getHistorySummary: vi.fn(async () => {
        const entries = useMoodsStore.getState().moods;
        return {
          totalCount: entries.length,
          oldestTimestamp: entries.length
            ? Math.min(...entries.map((entry) => entry.timestamp))
            : null,
          days: entries,
        };
      }),
    },
  };
});

let renderer: ReactTestRenderer;
let result: InsightsData;
function Harness() {
  result = useInsightsData();
  return null;
}
async function mount() {
  await act(async () => {
    renderer = create(<Harness />);
  });
}

describe("useInsightsData hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T12:00:00"));
    useMoodsStore.getState().setLocal([]);
    useMoodsStore.setState({
      ensureFresh: vi.fn().mockResolvedValue(undefined),
    });
  });
  afterEach(async () => {
    if (renderer)
      await act(async () => {
        renderer.unmount();
      });
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("shows an initial hydration error instead of endless loading", async () => {
    useMoodsStore.setState({
      status: "error",
      error: "read failed",
      isStale: true,
    });
    await mount();
    expect(result.loading).toBe(false);
    expect(result.error).toBe("read failed");
  });

  it("reuses full-history streaks across navigation and recalculates at local midnight", async () => {
    vi.setSystemTime(new Date("2026-09-06T23:59:59"));
    useMoodsStore.getState().setLocal([
      createMockMoodEntry({
        timestamp: new Date("2026-09-05T12:00:00").getTime(),
      }),
    ]);
    const calculate = vi.spyOn(streaks, "calculateStreak");
    await mount();
    expect(result.streak.current).toBe(1);
    const initialCalls = calculate.mock.calls.length;
    await act(async () => {
      result.setAnalysisRange("90");
    });
    await act(async () => {
      result.setAnalysisRange("all");
    });
    expect(calculate).toHaveBeenCalledTimes(initialCalls);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.streak.current).toBe(0);
    expect(calculate).toHaveBeenCalledTimes(initialCalls + 1);
  });

  it("updates the local day when returning from the background", async () => {
    useMoodsStore.getState().setLocal([
      createMockMoodEntry({
        timestamp: new Date("2026-09-05T12:00:00").getTime(),
      }),
    ]);
    await mount();
    expect(result.streak.current).toBe(1);
    vi.setSystemTime(new Date("2026-09-08T12:00:00"));
    await act(async () => {
      native.listener?.("active");
    });
    expect(result.streak.current).toBe(0);
  });
  it("queries bounded windows and recomputes from a confirmed revision", async () => {
    const data = createMockMoodEntry({
      timestamp: new Date("2026-09-06T10:00:00").getTime(),
    });
    useMoodsStore.getState().setLocal([data]);
    await mount();
    expect(result.analysisMoods).toHaveLength(1);
    const query = vi.mocked(moodService.getInRange);
    expect(
      query.mock.calls
        .slice(-3)
        .every(
          ([range]) =>
            range &&
            "startDate" in range &&
            typeof range.startDate === "number" &&
            typeof range.endDate === "number",
        ),
    ).toBe(true);
    await act(async () => {
      useMoodsStore.getState().setLocal([data, { ...data, id: data.id + 1 }]);
    });
    expect(result.analysisMoods).toHaveLength(2);
    expect(result.totalCount).toBe(2);
  });

  it("rejects an older response after the selected range changes", async () => {
    await mount();
    let resolveOld!: (value: ReturnType<typeof createMockMoodEntry>[]) => void;
    vi.mocked(moodService.getInRange).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    let refreshing!: Promise<void>;
    await act(async () => {
      refreshing = result.refresh();
    });
    await act(async () => {
      result.setAnalysisRange("7");
    });
    await act(async () => {
      resolveOld([createMockMoodEntry()]);
      await refreshing;
    });
    expect(result.analysisRange).toBe("7");
    expect(result.analysisMoods).toEqual([]);
  });

  it("includes entries on their recorded day across a device midnight", async () => {
    const data = createMockMoodEntry({
      timestamp: Date.parse("2026-09-07T01:00:00Z"),
      utcOffsetMinutes: 240,
    });
    useMoodsStore.getState().setLocal([data]);
    await mount();
    expect(result.analysisMoods).toHaveLength(1);
    expect(
      result.analysis.dailySeries.find((point) => point.day === "2026-09-06")
        ?.count,
    ).toBe(1);
  });

  it("keeps a newer history summary when an older refresh resolves last", async () => {
    await mount();
    let resolveOld!: (
      value: Awaited<ReturnType<typeof moodService.getHistorySummary>>,
    ) => void;
    vi.mocked(moodService.getHistorySummary).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    let refreshing!: Promise<void>;
    await act(async () => {
      refreshing = result.refresh();
    });
    const data = createMockMoodEntry({
      timestamp: new Date("2026-09-06T10:00:00").getTime(),
    });
    await act(async () => {
      useMoodsStore.getState().setLocal([data]);
    });
    expect(result.totalCount).toBe(1);
    await act(async () => {
      resolveOld({ totalCount: 0, oldestTimestamp: null, days: [] });
      await refreshing;
    });
    expect(result.totalCount).toBe(1);
    expect(result.streak.current).toBe(1);
  });

  it("does not label stale All data as a failed narrower range", async () => {
    useMoodsStore
      .getState()
      .setLocal([
        createMockMoodEntry({ timestamp: Date.parse("2025-01-01T12:00:00Z") }),
      ]);
    await mount();
    await act(async () => result.setAnalysisRange("all"));
    expect(result.analysisMoods).toHaveLength(1);
    vi.mocked(moodService.getInRange).mockRejectedValueOnce(
      new Error("range failed"),
    );
    await act(async () => result.setAnalysisRange("7"));
    expect(result.error).toBe("range failed");
    expect(result.analysisMoods).toEqual([]);
    expect(result.analysis.drivers).toEqual([]);
  });
});
