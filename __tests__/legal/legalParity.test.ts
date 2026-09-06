import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const privacyPolicy = readFileSync("PRIVACY_POLICY.md", "utf8");
const privacyScreen = readFileSync("src/app/settings/privacy-policy.tsx", "utf8");
const terms = readFileSync("TERMS_OF_SERVICE.md", "utf8");
const termsScreen = readFileSync("src/app/settings/terms-of-service.tsx", "utf8");
const license = readFileSync("LICENSE", "utf8");


function withoutMarkdownEmphasis(source: string): string {
  return source.replaceAll("**", "");
}

describe("legal document parity", () => {
  it.each([
    ["privacy", privacyPolicy, privacyScreen],
    ["terms", terms, termsScreen],
  ])("keeps the %s policy date aligned with its in-app screen", (_, document, screen) => {
    const datePattern = /Last Updated: ([A-Za-z]+ \d{1,2}, \d{4})/;
    const documentDate = document.match(datePattern)?.[1];
    const screenDate = screen.match(datePattern)?.[1];
    expect(documentDate).toBeDefined();
    expect(Number.isNaN(Date.parse(documentDate!))).toBe(false);
    expect(screenDate).toBe(documentDate);
  });

  it("keeps core privacy disclosures in the root and in-app policies", () => {
    for (const rawSource of [privacyPolicy, privacyScreen]) {
      const source = withoutMarkdownEmphasis(rawSource);
      expect(source).toContain("no developer-operated server");
      expect(source).toContain("does not apply database-level encryption");
      expect(source).toContain("salted hash");
      expect(source).toContain("plaintext JSON");
      expect(source).toContain("plaintext CSV");
      expect(source).toContain("clipboard");
      expect(source).toContain("at most once per week");
      expect(source).toContain("eight newest app-managed");
      expect(source).toContain("Delete Mood Data");
      expect(source).toContain("database emotion records");
      expect(source).toContain("Emotion List presets");
      expect(source).toContain("no developer-side");
      expect(source).not.toContain("Android database is encrypted");
    }
  });

  it("keeps health, crisis, deletion, and MIT terms in both Terms surfaces", () => {
    for (const source of [terms, termsScreen]) {
      expect(source).toContain(
        "not a medical device and does not diagnose, treat, cure, or prevent"
      );
      expect(source).toContain("does not monitor");
      expect(source).toContain("Delete Mood Data");
      expect(source).toContain("database emotion records");
      expect(source).toContain("Emotion List presets");
      expect(source).toContain("plaintext CSV");
      expect(source).toContain("at most once per week");
      expect(source).toContain("eight newest app-managed");
      expect(source).toContain("MIT License");
      expect(source).toContain("LICENSE");
      expect(source).toContain("Copyright (c) 2026 Moodinator contributors");
      expect(source).toContain("jurisdiction in which the app developer resides");
      expect(source).toContain("https://github.com/MaximilianMauroner/moodinator");
    }
  });

  it("tracks the canonical MIT license text", () => {
    expect(license).toContain("MIT License");
    expect(license).toContain("Copyright (c) 2026 Moodinator contributors");
    expect(license).toContain("Permission is hereby granted, free of charge");
  });

});
