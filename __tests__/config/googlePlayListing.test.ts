import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const listingPath = "docs/release/google-play/store-listing.md";
const assetRoot = "assets/store/google-play";
const publicContactPaths = [
  "README.md",
  "PRIVACY_POLICY.md",
  "TERMS_OF_SERVICE.md",
  "src/app/settings/about.tsx",
  "src/app/settings/privacy-policy.tsx",
  "src/app/settings/terms-of-service.tsx",
  listingPath,
];

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
    const releaseNotes = listing.match(
      /## Release notes\n\n([\s\S]*?)\n## App access and reviewer instructions/
    )?.[1];

    expect(shortDescription).toBeDefined();
    expect(shortDescription!.length).toBeLessThanOrEqual(80);
    expect(fullDescription).toBeDefined();
    expect(fullDescription!.length).toBeLessThanOrEqual(4_000);
    expect(releaseNotes).toBeDefined();
    expect(releaseNotes!.length).toBeLessThanOrEqual(500);
    expect(fullDescription).toContain(
      "Moodinator is not a medical device and does not diagnose, treat, cure, or prevent any medical condition. Consult a healthcare professional for medical advice, diagnosis, or treatment."
    );
    for (const publicContactPath of publicContactPaths) {
      const surface = readFileSync(publicContactPath, "utf8");
      expect(surface).toContain("support.moodinator@lab4code.com");
      expect(surface).not.toContain("lab4code.dev@gmail.com");
    }
    expect(listing).toContain(
      "Target audience: Ages 13–15, 16–17, and 18+"
    );
    expect(listing).toContain(
      "No Moodinator account, sign-in, subscription, or access credential is required."
    );
    expect(listing).toContain(
      "App lock is optional and disabled on a fresh install."
    );
    expect(listing).toContain("Mental and behavioral health");
    expect(listing).toContain("No required data collection or sharing");
    expect(listing).toMatch(/No preconfigured PIN is\s+supplied\./);
  });

  it("includes upload-ready icon and feature-graphic files", () => {
    const icon = readPngMetadata(join(assetRoot, "icon-512.png"));
    const featureGraphic = readPngMetadata(
      join(assetRoot, "feature-graphic-1024x500.png")
    );

    expect(icon).toMatchObject({ width: 512, height: 512, colorType: 6 });
    expect(featureGraphic).toMatchObject({
      width: 1024,
      height: 500,
      colorType: 2,
    });
    expect(icon.size).toBeLessThan(1_048_576);
    expect(featureGraphic.size).toBeLessThan(15_728_640);
  });

  it("includes at least five portrait phone screenshots", () => {
    const screenshotPaths = readdirSync(join(assetRoot, "screenshots"))
      .filter((name) => name.endsWith(".png"))
      .map((name) => join(assetRoot, "screenshots", name));

    expect(screenshotPaths.length).toBeGreaterThanOrEqual(5);
    expect(screenshotPaths).toContain(
      join(assetRoot, "screenshots", "05-history-insights.png")
    );
    for (const screenshotPath of screenshotPaths) {
      const screenshot = readPngMetadata(screenshotPath);
      expect(screenshot.width).toBeGreaterThanOrEqual(320);
      expect(screenshot.height).toBeGreaterThan(screenshot.width);
      expect(screenshot.height).toBeLessThanOrEqual(3_840);
      expect(screenshot.height).toBeLessThanOrEqual(screenshot.width * 2);
      expect(screenshot.colorType).toBe(2);
      expect(screenshot.size).toBeLessThan(8_388_608);
    }
  });
});
