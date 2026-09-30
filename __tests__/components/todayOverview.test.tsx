import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MoodEntry } from "@db/types";

vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  useColorScheme: () => "dark",
  Platform: { OS: "android", select: (values: Record<string, unknown>) => values.android ?? values.default },
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

import { EarlierToday, TodayNow } from "@/components/home/TodayOverview";

function entry(id: number, mood: number, extra: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id,
    mood,
    timestamp: Date.UTC(2026, 8, 30, 8 + id),
    utcOffsetMinutes: 0,
    emotions: [],
    contextTags: [],
    energy: null,
    note: null,
    moodScale: { version: 1, min: 0, max: 10, lowerIsBetter: true },
    basedOnEntryId: null,
    ...extra,
  };
}

let renderer: ReactTestRenderer;

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});

function texts() {
  return renderer.root.findAll((node) => node.type === "Text").map((node) =>
    [node.props.children].flat(Infinity).filter((part) => typeof part === "string" || typeof part === "number").join(""),
  );
}

describe("EarlierToday", () => {
  it("shows two entries with their detail and links the rest to History", async () => {
    const onShowAll = vi.fn();
    const onOpen = vi.fn();
    const first = entry(3, 6, {
      emotions: [{ name: "Tired", category: "negative" }, { name: "Stressed", category: "negative" }],
      contextTags: ["Work"],
      note: "Long meeting ran over lunch.",
    });
    await act(async () => {
      renderer = create(
        <EarlierToday entries={[first, entry(2, 2), entry(1, 3), entry(0, 5)]} onOpen={onOpen} onShowAll={onShowAll} />,
      );
    });

    const rows = renderer.root.findAll((node) => typeof node.props.testID === "string" && node.props.testID.startsWith("today-entry-"));
    expect(rows).toHaveLength(2);
    expect(texts()).toEqual(expect.arrayContaining(["Tired, Stressed · #Work", "Long meeting ran over lunch."]));

    await act(async () => rows[0]!.props.onPress());
    expect(onOpen).toHaveBeenCalledWith(first);

    await act(async () => renderer.root.findByProps({ accessibilityLabel: "2 more today. Opens History" }).props.onPress());
    expect(onShowAll).toHaveBeenCalledTimes(1);
  });

  it("renders nothing without earlier entries", async () => {
    await act(async () => {
      renderer = create(<EarlierToday entries={[]} onOpen={vi.fn()} onShowAll={vi.fn()} />);
    });
    expect(renderer.toJSON()).toBeNull();
  });
});

describe("TodayNow", () => {
  it("shows the newest entry with its detail and opens it", async () => {
    const onOpen = vi.fn();
    const latest = entry(4, 2, { emotions: [{ name: "Grateful", category: "positive" }], contextTags: ["Outside"], note: "Sun after the rain." });
    await act(async () => {
      renderer = create(<TodayNow latest={latest} loaded onOpen={onOpen} />);
    });

    expect(texts()).toEqual(expect.arrayContaining(["Grateful · #Outside", "Sun after the rain."]));
    await act(async () => renderer.root.findByProps({ accessibilityHint: "Opens this entry's details" }).props.onPress());
    expect(onOpen).toHaveBeenCalledWith(latest);
  });
});
