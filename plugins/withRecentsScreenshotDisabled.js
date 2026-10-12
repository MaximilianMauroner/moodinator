const { withMainActivity } = require("expo/config-plugins");

// Android takes the Recents thumbnail as the activity pauses, before
// JavaScript can draw the App Lock screen, so only native code can keep
// entries out of it. Unlike FLAG_SECURE, this still allows screenshots and
// screen recording. The API exists from Android 13; older versions keep
// their thumbnail.
const ANCHOR = "super.onCreate(null)";
const CALL = "setRecentsScreenshotEnabled(false)";

function disableRecentsScreenshot(mainActivity) {
  if (mainActivity.includes(CALL)) return mainActivity;
  // Fail the prebuild rather than ship a build without the protection.
  if (!mainActivity.includes(ANCHOR)) {
    throw new Error(`MainActivity has no ${ANCHOR} call to disable the Recents screenshot after.`);
  }
  return mainActivity.replace(
    ANCHOR,
    `${ANCHOR}
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
      ${CALL}
    }`
  );
}

function withRecentsScreenshotDisabled(config) {
  return withMainActivity(config, (activity) => {
    if (activity.modResults.language !== "kt") {
      throw new Error("The Recents screenshot plugin supports only a Kotlin MainActivity.");
    }
    activity.modResults.contents = disableRecentsScreenshot(activity.modResults.contents);
    return activity;
  });
}

module.exports = withRecentsScreenshotDisabled;
module.exports.disableRecentsScreenshot = disableRecentsScreenshot;
