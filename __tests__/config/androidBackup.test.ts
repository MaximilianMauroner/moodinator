import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Android privacy configuration", () => {
  it("disables Auto Backup and blocks the overlay permission", () => {
    const appConfig = JSON.parse(readFileSync("app.json", "utf8")) as {
      expo: {
        android: { allowBackup?: boolean; blockedPermissions?: string[] };
      };
    };

    expect(appConfig.expo.android.allowBackup).toBe(false);
    expect(appConfig.expo.android.blockedPermissions).toContain(
      "android.permission.SYSTEM_ALERT_WINDOW"
    );
  });
});
