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

  it("does not enable background remote notifications", () => {
    const appConfig = JSON.parse(readFileSync("app.json", "utf8")) as {
      expo: { plugins: (string | [string, Record<string, unknown>])[] };
    };
    const notificationsPlugin = appConfig.expo.plugins.find(
      (plugin): plugin is [string, Record<string, unknown>] =>
        Array.isArray(plugin) && plugin[0] === "expo-notifications"
    );

    expect(notificationsPlugin).toBeDefined();
    expect(notificationsPlugin?.[1]).not.toHaveProperty(
      "enableBackgroundRemoteNotifications"
    );
  });

  it("keeps SQLCipher disabled for the Android SQLite database", () => {
    const appConfig = JSON.parse(readFileSync("app.json", "utf8")) as {
      expo: { plugins: (string | [string, Record<string, unknown>])[] };
    };
    const sqlitePlugin = appConfig.expo.plugins.find(
      (plugin): plugin is [string, Record<string, unknown>] =>
        Array.isArray(plugin) && plugin[0] === "expo-sqlite"
    );
    const androidOptions = sqlitePlugin?.[1].android as
      | { useSQLCipher?: boolean }
      | undefined;

    expect(sqlitePlugin).toBeDefined();
    expect(androidOptions?.useSQLCipher).toBe(false);
  });
});
