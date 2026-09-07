import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Emotion } from "@db/types";
import { EmotionPicker } from "@/components/entry/EmotionPicker";

vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(async () => {}),
  performAndroidHapticsAsync: vi.fn(async () => {}),
  impactAsync: vi.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light" },
  AndroidHaptics: { Gesture_End: "gesture-end", Context_Click: "context-click" },
}));
vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Platform: { OS: "android", Version: 35, select: (v: Record<string, unknown>) => v.android ?? v.default },
  useColorScheme: () => "dark",
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
vi.mock("react-native-reanimated", async () => {
  const { useRef } = await import("react");
  return {
    default: { View: "AnimatedView", Text: "AnimatedText" },
    useSharedValue: (value: number) => useRef({ value }).current,
    useAnimatedStyle: (style: () => unknown) => style(),
    withSpring: (value: number) => value,
    FadeIn: { duration: () => undefined },
  };
});

const options: Emotion[] = [
  { name: "Excited", category: "positive" },   // high
  { name: "Angry", category: "negative" },     // high
  { name: "Happy", category: "positive" },     // steady
  { name: "Sad", category: "negative" },       // low
  { name: "Tired", category: "neutral" },      // low
  { name: "Dissatisfied", category: "negative" }, // custom, unrated
];

let renderer: ReactTestRenderer;

async function render(element: React.ReactElement) {
  await act(async () => {
    renderer = create(element);
  });
}

/** Visible text in render order, so grouping and ordering are both checked. */
function texts() {
  return renderer.root
    .findAllByType("Text" as unknown as React.ComponentType)
    .flatMap((node) => node.children)
    .filter((child): child is string => typeof child === "string");
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});

describe("EmotionPicker energy bands", () => {
  it("groups by activation and orders the bands high to low", async () => {
    await render(
      <EmotionPicker options={options} selected={[]} onChange={() => {}} />
    );
    const rendered = texts();
    const at = (label: string) => rendered.indexOf(label);

    expect(at("High energy")).toBeGreaterThanOrEqual(0);
    expect(at("Steady")).toBeGreaterThan(at("High energy"));
    expect(at("Low energy")).toBeGreaterThan(at("Steady"));

    // Each emotion sits inside its own band.
    expect(at("Angry")).toBeGreaterThan(at("High energy"));
    expect(at("Angry")).toBeLessThan(at("Steady"));
    expect(at("Happy")).toBeGreaterThan(at("Steady"));
    expect(at("Happy")).toBeLessThan(at("Low energy"));
    expect(at("Tired")).toBeGreaterThan(at("Low energy"));
  });

  it("mixes valences inside one band, which is the point of the grouping", async () => {
    await render(
      <EmotionPicker options={options} selected={[]} onChange={() => {}} />
    );
    const rendered = texts();
    const high = rendered.indexOf("High energy");
    const steady = rendered.indexOf("Steady");
    const inHighBand = rendered.slice(high, steady);

    expect(inHighBand).toContain("Excited"); // positive
    expect(inHighBand).toContain("Angry");   // negative
  });

  it("keeps unrated custom emotions in their own group at the end", async () => {
    await render(
      <EmotionPicker options={options} selected={[]} onChange={() => {}} />
    );
    const rendered = texts();

    expect(rendered.indexOf("Your own")).toBeGreaterThan(rendered.indexOf("Low energy"));
    expect(rendered.indexOf("Dissatisfied")).toBeGreaterThan(rendered.indexOf("Your own"));
  });

  it("omits a band that has no emotions", async () => {
    await render(
      <EmotionPicker
        options={[{ name: "Tired", category: "neutral" }]}
        selected={[]}
        onChange={() => {}}
      />
    );
    const rendered = texts();

    expect(rendered).toContain("Low energy");
    expect(rendered).not.toContain("High energy");
    expect(rendered).not.toContain("Steady");
    expect(rendered).not.toContain("Your own");
  });

  it("still exposes every option as a selectable control", async () => {
    await render(
      <EmotionPicker options={options} selected={[]} onChange={() => {}} />
    );
    for (const emotion of options) {
      expect(
        renderer.root.findByProps({ testID: `emotion-option-${emotion.name}` })
      ).toBeTruthy();
    }
  });
});
