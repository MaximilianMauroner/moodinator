import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { FindingCard } from "../../../src/features/insights/components/FindingCard";
import { RhythmGrid } from "../../../src/features/insights/components/RhythmGrid";
import { rhythm } from "../../../src/features/insights/utils/rhythm";
vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  useColorScheme: () => "dark",
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
});
