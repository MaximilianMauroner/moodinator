import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Android privacy configuration", () => {
  it("disables Android Auto Backup for local-only mood data", () => {
    const appConfig = JSON.parse(readFileSync("app.json", "utf8")) as {
      expo: { android: { allowBackup?: boolean } };
    };

    expect(appConfig.expo.android.allowBackup).toBe(false);
  });
});
