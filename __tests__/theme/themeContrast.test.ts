import { vi } from "vitest";

vi.mock("@/hooks/useColorScheme", () => ({ useColorScheme: () => "light" }));

import { colors, semanticToneColors } from "@/constants/colors";

function luminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => parseInt(channel, 16) / 255);

  if (!channels || channels.length !== 3) {
    throw new Error(`Expected a six-digit hex color, received ${hex}`);
  }

  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4)
  );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string): number {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

describe("theme contrast", () => {
  it("keeps primary action content readable", () => {
    for (const mode of ["light", "dark"] as const) {
      expect(contrast(colors.onPrimary[mode], colors.primary[mode])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps category text readable in selected and unselected states", () => {
    for (const category of [colors.positive, colors.negative, colors.neutral]) {
      for (const mode of ["light", "dark"] as const) {
        expect(contrast(category.text[mode], category.bg[mode])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(category.textSelected[mode], category.bgSelected[mode])).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps semantic tone foregrounds readable", () => {
    for (const tone of Object.values(semanticToneColors)) {
      for (const mode of ["light", "dark"] as const) {
        expect(contrast(tone[mode].fg, tone[mode].bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
