import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { disableRecentsScreenshot } = require("../../plugins/withRecentsScreenshotDisabled.js") as {
  disableRecentsScreenshot: (mainActivity: string) => string;
};

// The onCreate of the Expo SDK 55 MainActivity after the splash screen plugin.
const mainActivity = `class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)
  }
}
`;

describe("Recents screenshot plugin", () => {
  it("disables the Recents screenshot on Android 13 and later, after the activity is created", () => {
    expect(disableRecentsScreenshot(mainActivity)).toContain(`    super.onCreate(null)
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
      setRecentsScreenshotEnabled(false)
    }
  }`);
  });

  it("leaves an already updated MainActivity unchanged when prebuild runs again", () => {
    const updated = disableRecentsScreenshot(mainActivity);

    expect(disableRecentsScreenshot(updated)).toBe(updated);
  });

  it("fails the prebuild when the template no longer has the expected onCreate call", () => {
    expect(() =>
      disableRecentsScreenshot(mainActivity.replace("super.onCreate(null)", "super.onCreate(savedInstanceState)"))
    ).toThrow("MainActivity has no super.onCreate(null) call");
  });
});
