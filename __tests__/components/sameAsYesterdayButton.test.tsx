import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLastEntry: vi.fn(),
  tap: vi.fn(),
  commit: vi.fn(),
  reject: vi.fn(),
}));

vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Modal: "Modal",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  View: "View",
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
vi.mock("react-native-reanimated", async () => {
  const { useRef } = await import("react");
  return {
    default: { View: "AnimatedView" },
    Easing: { out: (value: unknown) => value, in: (value: unknown) => value, cubic: "cubic" },
    useAnimatedStyle: (style: () => unknown) => style(),
    useSharedValue: (value: number) => useRef({ value }).current,
    withSpring: (value: number) => value,
    withTiming: (value: number) => value,
  };
});
vi.mock("@/services/moodService", () => ({ moodService: { getLastEntry: mocks.getLastEntry } }));
vi.mock("@/lib/haptics", () => ({ haptics: mocks }));
vi.mock("@/constants/colors", () => ({
  colors: {
    primary: { light: "#fff" },
    primaryBg: { dark: "#000", light: "#fff" },
    sand: { bg: { light: "#fff" }, bgHover: { dark: "#000", light: "#fff" } },
    positive: { textDark: { light: "#000" } },
  },
  useThemeColors: () => ({ isDark: false, get: () => "#000" }),
}));
vi.mock("@/constants/moodScaleInterpretation", () => ({
  getMoodRatingDisplay: (value: number) => ({
    label: `Mood ${value}`,
    backgroundHex: "#fff",
    colorHex: "#000",
  }),
}));

import { SameAsYesterdayButton } from "@/components/entry/SameAsYesterdayButton";

const entry = {
  id: 42,
  mood: 4,
  note: "A note",
  timestamp: Date.parse("2026-04-01T12:00:00Z"),
  utcOffsetMinutes: 0,
  emotions: [],
  contextTags: [],
  energy: null,
  moodScale: { version: 1, min: 0, max: 10, lowerIsBetter: true } as const,
  basedOnEntryId: null,
};

let renderer: ReactTestRenderer;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  mocks.getLastEntry.mockResolvedValue(entry);
});

afterEach(() => {
  if (renderer) renderer.unmount();
});

async function render(onCopy = vi.fn()) {
  await act(async () => {
    renderer = create(<SameAsYesterdayButton onCopy={onCopy} />);
  });
  return onCopy;
}

function copyButton() {
  return renderer.root.findByProps({ accessibilityLabel: "Copy last entry" });
}

describe("SameAsYesterdayButton", () => {
  it("copies into the draft on tap and describes the real effect", async () => {
    const onCopy = await render();

    expect(copyButton().props.accessibilityRole).toBe("button");
    expect(copyButton().props.accessibilityHint).toContain("copy");
    await act(async () => copyButton().props.onPress());

    expect(onCopy).toHaveBeenCalledWith(entry);
    expect(mocks.commit).toHaveBeenCalledTimes(1);
  });

  it("does not run the tap action after a long press and exposes preview actions", async () => {
    const onCopy = await render();

    await act(async () => copyButton().props.onLongPress());
    expect(onCopy).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ accessibilityLabel: "Cancel preview" })).toBeTruthy();
    expect(renderer.root.findByProps({ accessibilityLabel: "Close preview" })).toBeTruthy();
    expect(renderer.root.findByProps({ accessibilityLabel: "Use this entry" })).toBeTruthy();

    await act(async () => renderer.root.findByProps({ accessibilityLabel: "Use this entry" }).props.onPress());
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it("keeps the empty state disabled and truthful", async () => {
    mocks.getLastEntry.mockResolvedValue(null);
    await render();
    await act(async () => copyButton().props.onPress());

    const empty = copyButton();
    expect(empty.props.disabled).toBe(true);
    expect(empty.props.accessibilityState).toEqual({ disabled: true });
  });

  it("distinguishes a read failure and offers an accessible retry", async () => {
    const onCopy = await render();
    mocks.getLastEntry.mockRejectedValueOnce(new Error("database unavailable"));

    await act(async () => copyButton().props.onPress());

    const retry = renderer.root.findByProps({
      accessibilityLabel: "Retry copying last entry",
    });
    expect(retry.props.accessibilityRole).toBe("button");
    expect(retry.props.accessibilityHint).toContain("try again");
    expect(onCopy).not.toHaveBeenCalled();

    await act(async () => retry.props.onPress());

    expect(onCopy).toHaveBeenCalledWith(entry);
    expect(mocks.getLastEntry).toHaveBeenCalledTimes(2);
  });

  it("does not turn a failed long press into a second tap or copy", async () => {
    const onCopy = await render();
    mocks.getLastEntry.mockRejectedValueOnce(new Error("database unavailable"));
    const initialButton = copyButton();

    await act(async () => initialButton.props.onLongPress());

    expect(onCopy).not.toHaveBeenCalled();
    expect(mocks.getLastEntry).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByProps({
      accessibilityLabel: "Retry copying last entry",
    })).toBeTruthy();
  });
});
