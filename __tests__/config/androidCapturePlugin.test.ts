import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { protectCaptureDuringStartup } = require("../../plugins/withAndroidCaptureProtection.js") as {
  protectCaptureDuringStartup: (mainActivity: string) => string;
};

const mainActivity = `class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    SplashScreenManager.registerOnActivity(this)
    super.onCreate(null)
  }
}
`;

describe("Android capture startup plugin", () => {
  it("protects the window before React starts and App Lock settings are read", () => {
    expect(protectCaptureDuringStartup(mainActivity)).toContain(
      "window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)\n    super.onCreate(null)"
    );
  });

  it("does not duplicate protection when native generation repeats", () => {
    const protectedActivity = protectCaptureDuringStartup(mainActivity);
    expect(protectCaptureDuringStartup(protectedActivity)).toBe(protectedActivity);
  });

  it("rejects template drift instead of silently skipping cold-start protection", () => {
    expect(() => protectCaptureDuringStartup(mainActivity.replace("super.onCreate(null)", "")))
      .toThrow("MainActivity has no super.onCreate(null) call");
  });

  it("requires a clean regeneration of old unconditional Recents code", () => {
    expect(() => protectCaptureDuringStartup(mainActivity + "setRecentsScreenshotEnabled(false)"))
      .toThrow("Remove stale unconditional Recents protection");
  });
});
