import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  View: "View", Text: "Text", Modal: "Modal", Pressable: "Pressable", ScrollView: "ScrollView",
  useColorScheme: () => "dark",
  Platform: { OS: "android", select: (values: Record<string, unknown>) => values.android ?? values.default },
}));
vi.mock("@/lib/haptics", () => ({ haptics: { tap: vi.fn(), tick: vi.fn() } }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

import { DayDetailModal } from "@/components/calendar/DayDetailModal";

it("distinguishes archived days with the same weekday, month and day in different years", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const headings: string[] = [];
  for (const year of [2020, 2026]) {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<DayDetailModal visible date={new Date(year, 9, 4)} entries={[]} onClose={vi.fn()} />);
    });
    try {
      const texts = renderer.root.findAll((node) => node.type === "Text");
      headings.push(texts[0]!.props.children);
      expect(texts.some((node) => node.props.children === "No entries")).toBe(true);
    } finally {
      await act(async () => renderer.unmount());
    }
  }
  expect(headings[0]).not.toBe(headings[1]);
  expect(headings[0]).toContain("2020");
  expect(headings[1]).toContain("2026");
});
