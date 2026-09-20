import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { FindingCard } from "../../../src/features/insights/components/FindingCard";
import { RhythmGrid } from "../../../src/features/insights/components/RhythmGrid";
import { rhythm } from "../../../src/features/insights/utils/rhythm";
import { InsightsScreen } from "../../../src/features/insights/screens/InsightsScreen";

const insightsScreenState = vi.hoisted(() => ({
  analysisMoods: [] as Array<Record<string, unknown>>,
  error: null as string | null,
}));

vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  RefreshControl: "RefreshControl",
  ScrollView: "ScrollView",
  Platform: { OS: "ios" },
  useColorScheme: () => "dark",
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("react-native-gesture-handler", () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../../../src/features/insights/hooks/useInsightsData", () => ({
  useInsightsData: () => ({
    recentMoods: [],
    totalCount: insightsScreenState.analysisMoods.length,
    loading: false,
    error: insightsScreenState.error,
    streak: { current: 0, longest: 0 },
    getMoodLabel: () => "Neutral",
    getMoodColor: () => "#000",
    refresh: vi.fn(async () => {}),
    analysis: {
      findings: [],
      dailySeries: [],
      rhythm: [],
      drivers: [],
      inconclusiveDrivers: [],
    },
    analysisRange: "7",
    setAnalysisRange: vi.fn(),
    analysisMoods: insightsScreenState.analysisMoods,
  }),
}));
vi.mock("../../../src/features/insights/components/InsightCard", () => ({
  InsightCard: () => null,
  CompactInsightCard: () => null,
}));
vi.mock("../../../src/features/insights/components/StreakBadge", () => ({ StreakBadge: () => null }));
vi.mock("../../../src/features/insights/components/EntryDetailModal", () => ({ EntryDetailModal: () => null }));
vi.mock("../../../src/features/insights/components/InsightsHeader", () => ({ InsightsHeader: () => null }));
vi.mock("../../../src/features/insights/components/TrendBand", () => ({ TrendBand: () => null }));
vi.mock("../../../src/features/insights/components/DriverRow", () => ({
  DriverRow: () => null,
  ComparisonBars: () => null,
}));
vi.mock("@/components/calendar", () => ({ MoodCalendar: () => null }));
vi.mock("@/components/ui/EmptyState", () => ({ EmptyState: () => null }));
vi.mock("@/components/ui/LoadingSpinner", () => ({ LoadingSpinner: () => null }));
vi.mock("@/components/layout/ScreenBackgroundAccent", () => ({ ScreenBackgroundAccent: () => null }));
vi.mock("@/components/ui/SegmentedControl", () => ({ SegmentedControl: () => null }));
vi.mock("@/hooks/usePullToRefresh", () => ({
  usePullToRefresh: () => ({ refreshing: false, onRefresh: vi.fn() }),
}));
vi.mock("@expo/vector-icons", () => {
  const Ionicons = () => null;
  Ionicons.glyphMap = {};
  return { Ionicons };
});
vi.mock("@/constants/colors", () => ({
  getThemedColor: () => "#000",
  useThemeColors: () => ({ isDark: true, get: () => "#000" }),
}));
vi.mock("@/components/ui/SurfaceCard", () => ({
  SurfaceCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
function textOf(renderer: ReactTestRenderer) {
  return JSON.stringify(renderer.toJSON());
}
describe("insight presentation", () => {
  it("renders the claim and both sample sizes visibly", async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <FindingCard
          finding={{
            id: "outside",
            effect: -2,
            text: "Outside entries average 2.0 better.",
            sample: "5 with · 8 without",
            means: [2, 4],
          }}
        />,
      );
    });
    expect(textOf(renderer)).toContain("Outside entries average 2.0 better.");
    expect(textOf(renderer)).toContain("5 with · 8 without");
    expect(textOf(renderer)).toContain("Lower is better");
    await act(async () => renderer.unmount());
  });
  it("exposes every empty rhythm cell and does not label it as a zero mood", async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<RhythmGrid cells={rhythm([])} />);
    });
    const cells = renderer.root.findAll(
      (node) => typeof node.props.accessibilityLabel === "string",
    );
    expect(cells).toHaveLength(28);
    expect(
      cells.every((cell) =>
        cell.props.accessibilityLabel.includes("no entries"),
      ),
    ).toBe(true);
    await act(async () => renderer.unmount());
  });

  it.each([0, 1, 2])("renders the correct visible entry plural for %i records", async (count) => {
    insightsScreenState.error = null;
    insightsScreenState.analysisMoods = Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      mood: 4,
      timestamp: Date.parse("2026-09-06T12:00:00Z"),
      utcOffsetMinutes: 0,
      emotions: [],
      contextTags: [],
      energy: null,
      moodScale: { version: 1, min: 0, max: 10, lowerIsBetter: true },
    }));
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<InsightsScreen />);
    });

    const rendered = renderer.root
      .findAllByType("Text")
      .map((node) => node.children.join(""))
      .join(" ");
    const expected = `${count} ${count === 1 ? "entry" : "entries"}`;
    expect(rendered).toContain(expected);
    expect(rendered).not.toContain(`${count} ${count === 1 ? "entries" : "entry"}`);
    await act(async () => renderer.unmount());
  });

  it("does not expose matrix readiness while saved insights have a refresh error", async () => {
    insightsScreenState.analysisMoods = [{
      id: 1,
      mood: 4,
      timestamp: Date.parse("2026-09-06T12:00:00Z"),
      utcOffsetMinutes: 0,
      emotions: [],
      contextTags: [],
      energy: null,
      moodScale: { version: 1, min: 0, max: 10, lowerIsBetter: true },
    }];
    insightsScreenState.error = "refresh failed";
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<InsightsScreen />);
    });

    expect(renderer.root.findAllByProps({ testID: "insights-loaded-summary" })).toHaveLength(0);
    const rendered = renderer.root
      .findAllByType("Text")
      .map((node) => node.children.filter((child) => typeof child === "string").join(""))
      .join(" ");
    expect(rendered).toContain("Showing saved insights. Refresh failed.");
    await act(async () => renderer.unmount());
    insightsScreenState.error = null;
  });
});
