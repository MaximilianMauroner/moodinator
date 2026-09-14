import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const listingPath = "docs/release/google-play/store-listing.md";
const assetRoot = "assets/store/google-play";

function readPngMetadata(path: string) {
  const png = readFileSync(path);
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");

  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
    colorType: png[25],
    size: statSync(path).size,
  };
}

describe("Google Play listing package", () => {
  it("keeps required copy within Play limits and includes release guardrails", () => {
    const listing = readFileSync(listingPath, "utf8");
    const shortDescription = listing.match(
      /## Short description\n\n([^\n]+)/
    )?.[1];
    const fullDescription = listing.match(
      /## Full description\n\n([\s\S]*?)\n## Release notes/
    )?.[1];

    expect(shortDescription).toBeDefined();
    expect(shortDescription!.length).toBeLessThanOrEqual(80);
    expect(fullDescription).toBeDefined();
    expect(fullDescription!.length).toBeLessThanOrEqual(4_000);
    expect(listing).toContain("lab4code.dev@gmail.com");
    expect(fullDescription).toContain(
      "Moodinator is not a medical device and does not diagnose, treat, cure, or prevent any medical condition. Consult a healthcare professional for medical advice, diagnosis, or treatment."
    );
  });

  it("includes upload-ready icon and feature-graphic files", () => {
    const icon = readPngMetadata(join(assetRoot, "icon-512.png"));
    const featureGraphic = readPngMetadata(
      join(assetRoot, "feature-graphic-1024x500.png")
    );

    expect(icon).toMatchObject({ width: 512, height: 512, colorType: 2 });
    expect(featureGraphic).toMatchObject({
      width: 1024,
      height: 500,
      colorType: 2,
    });
    expect(icon.size).toBeLessThan(1_048_576);
    expect(featureGraphic.size).toBeLessThan(15_728_640);
  });

  it("includes at least four portrait phone screenshots", () => {
    const screenshotPaths = readdirSync(join(assetRoot, "screenshots"))
      .filter((name) => name.endsWith(".png"))
      .map((name) => join(assetRoot, "screenshots", name));

    expect(screenshotPaths.length).toBeGreaterThanOrEqual(4);
    for (const screenshotPath of screenshotPaths) {
      const screenshot = readPngMetadata(screenshotPath);
      expect(screenshot.width).toBeGreaterThanOrEqual(320);
      expect(screenshot.height).toBeGreaterThan(screenshot.width);
      expect(screenshot.height).toBeLessThanOrEqual(3_840);
      expect(screenshot.size).toBeLessThan(8_388_608);
    }
  });
});
