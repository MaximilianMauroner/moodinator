const { withMainActivity } = require("expo/config-plugins");

const ANCHOR = "super.onCreate(null)";
const SECURE_START = "window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)";

// Start secure while the persisted App Lock preference is unknown. Hydration
// releases this flag when App Lock is off, before private content is shown.
function protectCaptureDuringStartup(mainActivity) {
  if (mainActivity.includes("setRecentsScreenshotEnabled(false)")) {
    throw new Error("Remove stale unconditional Recents protection with a clean Android prebuild.");
  }
  if (mainActivity.includes(SECURE_START)) return mainActivity;
  if (!mainActivity.includes(ANCHOR)) {
    throw new Error(`MainActivity has no ${ANCHOR} call to protect capture before startup.`);
  }
  return mainActivity.replace(ANCHOR, `${SECURE_START}\n    ${ANCHOR}`);
}

function withAndroidCaptureProtection(config) {
  return withMainActivity(config, (activity) => {
    if (activity.modResults.language !== "kt") {
      throw new Error("The capture protection plugin supports only a Kotlin MainActivity.");
    }
    activity.modResults.contents = protectCaptureDuringStartup(activity.modResults.contents);
    return activity;
  });
}

module.exports = withAndroidCaptureProtection;
module.exports.protectCaptureDuringStartup = protectCaptureDuringStartup;
