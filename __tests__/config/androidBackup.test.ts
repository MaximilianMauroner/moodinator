import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Android privacy configuration", () => {
  it("disables Auto Backup and blocks unused sensitive permissions", () => {
    const appConfig = JSON.parse(readFileSync("app.json", "utf8")) as {
      expo: {
        android: { allowBackup?: boolean; blockedPermissions?: string[] };
      };
    };

    expect(appConfig.expo.android.allowBackup).toBe(false);
    expect(appConfig.expo.android.blockedPermissions).toContain(
      "android.permission.SYSTEM_ALERT_WINDOW"
    );
    expect(appConfig.expo.android.blockedPermissions).toContain(
      "com.google.android.gms.permission.AD_ID"
    );
    expect(appConfig.expo.android.blockedPermissions).toContain(
      "android.permission.FOREGROUND_SERVICE"
    );
  });

  it("uses a product-specific deep-link scheme", () => {
    const appConfig = JSON.parse(readFileSync("app.json", "utf8")) as {
      expo: { scheme?: string };
    };

    expect(appConfig.expo.scheme).toBe("moodinator");
  });

  it("redirects the developer route out of production builds", () => {
    const developerRoute = readFileSync(
      "src/app/settings/developer.tsx",
      "utf8"
    );

    expect(developerRoute).toMatch(
      /if \(!__DEV__\) \{\s*return <Redirect href="\/\(tabs\)\/settings" \/>;/
    );
    expect(developerRoute.indexOf("if (!__DEV__)"))
      .toBeLessThan(developerRoute.indexOf("<DeveloperSettingsScreen />"));
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
