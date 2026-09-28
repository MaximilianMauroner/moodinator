import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { DriverRow } from "../../../src/features/insights/components/DriverRow";
import { RhythmGrid } from "../../../src/features/insights/components/RhythmGrid";
import { rhythm } from "../../../src/features/insights/utils/rhythm";
import { InsightsScreen } from "../../../src/features/insights/screens/InsightsScreen";

const insightsScreenState = vi.hoisted(() => ({
  analysisMoods: [] as Array<Record<string, unknown>>,
  analysisRange: "7" as "7" | "30",
  drivers: [] as Array<Record<string, unknown>>,
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
      dailySeries: [],
      rhythm: [],
      drivers: insightsScreenState.drivers,
    },
    analysisRange: insightsScreenState.analysisRange,
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
vi.mock("@/lib/moodPresentation", () => ({ getMoodHex: () => "#000" }));
vi.mock("@/components/calendar", () => ({ MoodCalendar: () => null }));
vi.mock("@/components/ui/EmptyState", () => ({ EmptyState: () => null }));
vi.mock("@/components/ui/LoadingSpinner", () => ({ LoadingSpinner: () => null }));
vi.mock("@/components/layout/ScreenBackgroundAccent", () => ({ ScreenBackgroundAccent: () => null }));
vi.mock("@/components/ui/SegmentedControl", () => ({
  SegmentedControl: ({ items }: { items: { label: string }[] }) =>
    React.createElement("Text", null, items.map((item) => item.label).join(" · ")),
}));
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
describe("insight presentation", () => {
  it("renders both recorded averages and sample sizes without a pattern claim", async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <DriverRow
          driver={{
            id: "outside",
            name: "Outside",
            kind: "context",
            withCount: 5,
            withoutCount: 8,
            withMean: 2,
            withoutMean: 4,
          }}
        />,
      );
    });
    const rendered = renderer.root.findAllByType("Text")
      .map((node) => node.children.join(""))
      .join(" ");
    expect(rendered).toContain("2.0 average with (5) · 4.0 without (8)");
    expect(rendered).toContain("Context tag: Outside");
    expect(rendered).not.toContain("2.0 better");
    await act(async () => renderer.unmount());
  });
  it("distinguishes a context tag from an emotion with the same name", async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <>
          <DriverRow driver={{ id: "context:Calm", name: "Calm", kind: "context", withCount: 5, withoutCount: 5, withMean: 2, withoutMean: 6 }} />
          <DriverRow driver={{ id: "emotion:Calm", name: "Calm", kind: "emotion", withCount: 5, withoutCount: 5, withMean: 7, withoutMean: 3 }} />
        </>,
      );
    });
    const labels = renderer.root.findAllByType("View")
      .map((node) => node.props.accessibilityLabel)
      .filter((label) => typeof label === "string");
    expect(labels[0]).toContain("Context tag: Calm, average 2.0 with");
    expect(labels[1]).toContain("Emotion: Calm, average 7.0 with");
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

  it("bounds comparison rows and resets the batch when the range changes", async () => {
    insightsScreenState.error = null;
    insightsScreenState.drivers = Array.from({ length: 2000 }, (_, index) => ({
      id: `context:Tag${index}`,
      name: `Tag${index}`,
      kind: "context",
      withCount: 5,
      withoutCount: 40,
      withMean: 2,
      withoutMean: 6,
    }));
    insightsScreenState.analysisRange = "7";
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<InsightsScreen />);
    });
    const visibleRows = () => renderer.root.findAllByType("View").filter(
      (node) => typeof node.props.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.startsWith("Context tag: Tag"),
    );
    expect(visibleRows()).toHaveLength(20);
    const showMore = () => renderer.root.findByProps({ accessibilityLabel: "Show more comparisons" });
    await act(async () => showMore().props.onPress());
    expect(visibleRows()).toHaveLength(40);
    insightsScreenState.analysisRange = "30";
    await act(async () => renderer.update(<InsightsScreen />));
    expect(visibleRows()).toHaveLength(20);
    await act(async () => renderer.unmount());
    insightsScreenState.drivers = [];
    insightsScreenState.analysisRange = "7";
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
    expect(rendered).toContain("Charts · Calendar");
    expect(rendered).not.toContain("Findings");
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
