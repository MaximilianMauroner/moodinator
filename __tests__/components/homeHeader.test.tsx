import React from "react";
import { act, create } from "react-test-renderer";
import { expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ View: "View", Text: "Text", useColorScheme: () => "dark", Platform: { select: (values: Record<string, unknown>) => values.default } }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
vi.mock("@/components/ui/SettingsGearButton", () => ({ SettingsGearButton: () => null }));
vi.mock("@/services/moodService", async () => ({
  ...(await import("../../src/services/moodEntryWorkflow")),
  moodService: { getPaginated: vi.fn(), getHistorySummary: vi.fn() },
}));

import { HomeHeader } from "@/components/home/HomeHeader";
import { moodService } from "@/services/moodService";
import { useMoodsStore } from "@/shared/state/moodsStore";

it("recovers a failed streak read after a successful history refresh without a mutation", async () => {
  useMoodsStore.setState({ lastLoadedAt: null, moods: [], filters: {}, isStale: true });
  vi.mocked(moodService.getHistorySummary)
    .mockRejectedValueOnce(new Error("read unavailable"))
    .mockResolvedValue({ totalCount: 1, oldestTimestamp: Date.now(), days: [{ timestamp: Date.now(), utcOffsetMinutes: null }] });
  vi.mocked(moodService.getPaginated).mockResolvedValue({ data: [], total: 0, hasMore: false });
  let renderer!: ReturnType<typeof create>;
  await act(async () => { renderer = create(<HomeHeader />); });
  expect(renderer.root.findAllByProps({ accessibilityLabel: "Streak: 1 day" })).toHaveLength(0);
  const revision = useMoodsStore.getState().revision;
  await act(async () => { await useMoodsStore.getState().refreshMoods(); });
  expect(useMoodsStore.getState().revision).toBe(revision);
  expect(renderer.root.findAllByProps({ accessibilityLabel: "Streak: 1 day" })).toHaveLength(1);
  await act(async () => renderer.unmount());
});
