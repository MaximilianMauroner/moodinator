import { describe, expect, it } from "vitest";

import { moodScale } from "@/constants/moodScale";

function luminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4
    );

  if (!channels || channels.length !== 3) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("mood scale contrast", () => {
  it("keeps every light and dark normal-text pair at WCAG AA contrast", () => {
    for (const mood of moodScale) {
      expect(contrast(mood.textHex!, mood.bgHex!), mood.label).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mood.textHexDark!, mood.bgHexDark!), mood.label).toBeGreaterThanOrEqual(4.5);
    }
  });
});
