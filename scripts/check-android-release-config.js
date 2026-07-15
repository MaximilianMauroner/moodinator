const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readOptionalText(relativePath) {
  const filePath = path.join(root, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const pkg = readJson("package.json");
const app = readJson("app.json");
const eas = readJson("eas.json");
const gradle = readOptionalText("android/app/build.gradle");
const mainManifest = readOptionalText("android/app/src/main/AndroidManifest.xml");
const strings = readOptionalText("android/app/src/main/res/values/strings.xml");

const productionAndroid = eas.build?.production?.android ?? {};
const androidPermissions = app.expo.android?.permissions ?? [];

assert(pkg.version === app.expo.version, "package.json and app.json versions differ");
assert(
  app.expo.name === "Moodinator",
  "app.json expo.name must be Moodinator"
);
assert(
  app.expo.android?.package === "com.lab4code.moodinator",
  "Android package must be com.lab4code.moodinator"
);
assert(
  !androidPermissions.includes("android.permission.SYSTEM_ALERT_WINDOW"),
  "app.json Android permissions must not request SYSTEM_ALERT_WINDOW"
);
assert(
  productionAndroid.buildType !== "apk",
  "EAS production Android build must not be configured as APK; Play release needs an AAB"
);

if (gradle) {
  const gradleVersionName = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
  const gradleVersionCode = Number(gradle.match(/versionCode\s+(\d+)/)?.[1]);

  assert(
    gradleVersionName === app.expo.version,
    `android/app/build.gradle versionName ${gradleVersionName} does not match app.json ${app.expo.version}`
  );
  assert(
    Number.isInteger(gradleVersionCode) && gradleVersionCode > 1,
    "android/app/build.gradle versionCode must be greater than the initial debug value"
  );
}

if (mainManifest) {
  assert(
    !mainManifest.includes("android.permission.SYSTEM_ALERT_WINDOW"),
    "Main Android manifest must not request SYSTEM_ALERT_WINDOW"
  );
}

if (strings) {
  assert(
    strings.includes('<string name="app_name">Moodinator</string>'),
    "Android app_name must be Moodinator"
  );
}

console.log("Android release config checks passed.");
