import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rootLayout = readFileSync("src/app/_layout.tsx", "utf8");

describe("status bar configuration", () => {
  it("uses contrasting system icons for the active color scheme", () => {
    expect(rootLayout).toContain('import { StatusBar } from "expo-status-bar";');
    expect(rootLayout).toContain('const isDark = useColorScheme() === "dark";');
    expect(rootLayout).toContain('<StatusBar style={isDark ? "light" : "dark"} />');
  });

  it("leaves the Android edge-to-edge background under app control", () => {
    expect(rootLayout).not.toMatch(/<StatusBar[^>]+backgroundColor=/);
    expect(rootLayout).not.toMatch(/<StatusBar[^>]+translucent=/);
  });
});
