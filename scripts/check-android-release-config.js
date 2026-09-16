const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const systemAlertWindowPermission = "android.permission.SYSTEM_ALERT_WINDOW";
const advertisingIdPermission = "com.google.android.gms.permission.AD_ID";
const requiredBlockedPermissions = new Set([
  systemAlertWindowPermission,
  advertisingIdPermission,
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "com.google.android.c2dm.permission.RECEIVE",
  "com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE",
  "com.sec.android.provider.badge.permission.READ",
  "com.sec.android.provider.badge.permission.WRITE",
  "com.htc.launcher.permission.READ_SETTINGS",
  "com.htc.launcher.permission.UPDATE_SHORTCUT",
  "com.sonyericsson.home.permission.BROADCAST_BADGE",
  "com.sonymobile.home.permission.PROVIDER_INSERT_BADGE",
  "com.anddoes.launcher.permission.UPDATE_COUNT",
  "com.majeur.launcher.permission.UPDATE_BADGE",
  "com.huawei.android.launcher.permission.CHANGE_BADGE",
  "com.huawei.android.launcher.permission.READ_SETTINGS",
  "com.huawei.android.launcher.permission.WRITE_SETTINGS",
  "android.permission.READ_APP_BADGE",
  "com.oppo.launcher.permission.READ_SETTINGS",
  "com.oppo.launcher.permission.WRITE_SETTINGS",
  "me.everything.badger.permission.BADGE_COUNT_READ",
  "me.everything.badger.permission.BADGE_COUNT_WRITE",
]);
const approvedReleasePermissions = new Set([
  "android.permission.INTERNET",
  "android.permission.USE_BIOMETRIC",
  "android.permission.USE_FINGERPRINT",
  "android.permission.VIBRATE",
  "android.permission.ACCESS_NETWORK_STATE",
  "android.permission.RECEIVE_BOOT_COMPLETED",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.WAKE_LOCK",
  "com.lab4code.moodinator.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION",
]);
const generatedManifestDirectoryNames = [
  "merged_manifest",
  "merged_manifests",
  "packaged_manifests",
];

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

function listFilesRecursively(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      return listFilesRecursively(entryPath);
    }

    return entry.isFile() ? [entryPath] : [];
  });
}

function findGeneratedReleaseManifests() {
  const intermediatesRoot = path.join(root, "android/app/build/intermediates");

  return generatedManifestDirectoryNames.flatMap((directoryName) => {
    const directoryPath = path.join(intermediatesRoot, directoryName);

    return listFilesRecursively(directoryPath).filter((filePath) => {
      if (path.basename(filePath) !== "AndroidManifest.xml") {
        return false;
      }

      return path
        .relative(directoryPath, filePath)
        .split(path.sep)
        .some((segment) => segment.toLowerCase().includes("release"));
    });
  });
}

function findPermissionDeclarations(manifest, permission) {
  const manifestWithoutComments = manifest.replace(/<!--[\s\S]*?-->/g, "");
  const permissionTags =
    manifestWithoutComments.match(/<uses-permission(?:-sdk-\d+)?\b[^>]*>/gi) ?? [];

  return permissionTags.filter((tag) => {
    const androidName = tag.match(/\bandroid:name\s*=\s*(["'])(.*?)\1/i)?.[2];
    return androidName === permission;
  });
}

function findDeclaredPermissions(manifest) {
  const manifestWithoutComments = manifest.replace(/<!--[\s\S]*?-->/g, "");
  const permissionTags =
    manifestWithoutComments.match(/<uses-permission(?:-sdk-\d+)?\b[^>]*>/gi) ?? [];

  return permissionTags
    .map((tag) => tag.match(/\bandroid:name\s*=\s*(["'])(.*?)\1/i)?.[2])
    .filter(Boolean);
}

function findTag(manifest, tagName) {
  return manifest.match(new RegExp(`<${tagName}\\b[^>]*>`, "i"))?.[0] ?? "";
}

function readAndroidAttribute(tag, attribute) {
  return tag.match(new RegExp(`\\bandroid:${attribute}\\s*=\\s*(["'])(.*?)\\1`, "i"))?.[2];
}

function removesPermissionDuringMerge(permissionDeclaration) {
  return (
    permissionDeclaration.match(/\btools:node\s*=\s*(["'])(.*?)\1/i)?.[2] ===
    "remove"
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readGradleVersionCode(gradle) {
  const literalVersionCode = gradle.match(/\bversionCode\s+(\d+)/)?.[1];
  if (literalVersionCode) return Number(literalVersionCode);

  const defaultVersionCode = gradle.match(
    /moodinatorVersionCode\s*=\s*\(findProperty\(['"]moodinatorVersionCode['"]\)\s*\?:\s*['"](\d+)['"]\)/
  )?.[1];

  return Number(defaultVersionCode);
}

const pkg = readJson("package.json");
const app = readJson("app.json");
const eas = readJson("eas.json");
const gradle = readOptionalText("android/app/build.gradle");
const mainManifest = readOptionalText("android/app/src/main/AndroidManifest.xml");
const strings = readOptionalText("android/app/src/main/res/values/strings.xml");
const developerRoute = readText("src/app/settings/developer.tsx");
const generatedReleaseManifests = findGeneratedReleaseManifests();
const requireGeneratedManifest = process.argv.includes("--require-generated-manifest");

const productionAndroid = eas.build?.production?.android ?? {};
const productionApk = eas.build?.["production-apk"] ?? {};
const androidPermissions = app.expo.android?.permissions ?? [];
const androidBlockedPermissions = app.expo.android?.blockedPermissions ?? [];

assert(pkg.version === app.expo.version, "package.json and app.json versions differ");
assert(
  app.expo.version === "0.1.5",
  `Google Play release marketing version must be 0.1.5, got ${app.expo.version}`
);
assert(
  app.expo.name === "Moodinator",
  "app.json expo.name must be Moodinator"
);
assert(
  app.expo.android?.package === "com.lab4code.moodinator",
  "Android package must be com.lab4code.moodinator"
);
assert(app.expo.scheme === "moodinator", "Expo deep-link scheme must be moodinator");
assert(
  app.expo.android?.allowBackup === false,
  "app.json expo.android.allowBackup must be false"
);
assert(
  !androidPermissions.includes(systemAlertWindowPermission),
  "app.json Android permissions must not request SYSTEM_ALERT_WINDOW"
);
assert(
  androidBlockedPermissions.includes(systemAlertWindowPermission),
  "app.json expo.android.blockedPermissions must include android.permission.SYSTEM_ALERT_WINDOW"
);
assert(
  androidBlockedPermissions.includes(advertisingIdPermission),
  "app.json expo.android.blockedPermissions must include com.google.android.gms.permission.AD_ID"
);
const missingBlockedPermissions = [...requiredBlockedPermissions].filter(
  (permission) => !androidBlockedPermissions.includes(permission)
);
assert(
  missingBlockedPermissions.length === 0,
  `app.json is missing required blocked permissions: ${missingBlockedPermissions.join(", ")}`
);
assert(
  productionAndroid.buildType !== "apk",
  "EAS production Android build must not be configured as APK; Play release needs an AAB"
);
assert(
  eas.cli?.appVersionSource === "remote" && eas.build?.production?.autoIncrement === true,
  "EAS production builds must use remote, auto-incremented Android version codes"
);
assert(
  productionApk.extends === "production" &&
    productionApk.autoIncrement === false &&
    productionApk.android?.buildType === "apk",
  "EAS production-apk builds must reuse the reserved remote version code"
);
assert(
  /if \(!__DEV__\) \{\s*return <Redirect href="\/\(tabs\)\/settings" \/>;/m.test(developerRoute),
  "Developer settings route must redirect away in production builds"
);

if (gradle) {
  const gradleVersionName = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
  const gradleVersionCode = readGradleVersionCode(gradle);

  assert(
    gradleVersionName === app.expo.version,
    `android/app/build.gradle versionName ${gradleVersionName} does not match app.json ${app.expo.version}`
  );
  assert(Number.isInteger(gradleVersionCode) && gradleVersionCode > 0,
    "android/app/build.gradle versionCode must be a positive integer");
}

if (mainManifest) {
  const applicationTag = findTag(mainManifest, "application");
  const systemAlertWindowDeclarations = findPermissionDeclarations(
    mainManifest,
    systemAlertWindowPermission
  );
  const advertisingIdDeclarations = findPermissionDeclarations(
    mainManifest,
    advertisingIdPermission
  );

  assert(
    readAndroidAttribute(applicationTag, "allowBackup") === "false",
    "Main Android manifest must set android:allowBackup=\"false\"; regenerate stale native files"
  );

  assert(
    systemAlertWindowDeclarations.every(removesPermissionDuringMerge),
    "Main Android manifest may only declare SYSTEM_ALERT_WINDOW with tools:node=\"remove\""
  );
  assert(
    advertisingIdDeclarations.every(removesPermissionDuringMerge),
    "Main Android manifest may only declare AD_ID with tools:node=\"remove\""
  );
  assert(
    /<data\b[^>]*\bandroid:scheme\s*=\s*(["'])moodinator\1/i.test(mainManifest),
    "Main Android manifest must use the moodinator deep-link scheme"
  );
}

assert(
  !requireGeneratedManifest || generatedReleaseManifests.length > 0,
  "No generated release manifest found. Run a clean Expo Android prebuild and Gradle :app:processReleaseMainManifest first."
);

for (const manifestPath of generatedReleaseManifests) {
  const manifest = fs.readFileSync(manifestPath, "utf8");
  const relativeManifestPath = path.relative(root, manifestPath);
  const manifestTag = findTag(manifest, "manifest");
  const usesSdkTag = findTag(manifest, "uses-sdk");
  const applicationTag = findTag(manifest, "application");
  const actualPermissions = new Set(findDeclaredPermissions(manifest));
  const unexpectedPermissions = [...actualPermissions].filter(
    (permission) => !approvedReleasePermissions.has(permission)
  );
  const missingPermissions = [...approvedReleasePermissions].filter(
    (permission) => !actualPermissions.has(permission)
  );

  assert(
    /\bpackage\s*=\s*(["'])com\.lab4code\.moodinator\1/i.test(manifestTag),
    `${relativeManifestPath} must use package com.lab4code.moodinator`
  );
  assert(
    readAndroidAttribute(usesSdkTag, "targetSdkVersion") === "36",
    `${relativeManifestPath} must target Android API 36`
  );
  assert(
    readAndroidAttribute(applicationTag, "allowBackup") === "false",
    `${relativeManifestPath} must set android:allowBackup=\"false\"`
  );
  assert(
    /<data\b[^>]*\bandroid:scheme\s*=\s*(["'])moodinator\1/i.test(manifest),
    `${relativeManifestPath} must use the moodinator deep-link scheme`
  );

  assert(
    findPermissionDeclarations(manifest, systemAlertWindowPermission).length === 0,
    `${relativeManifestPath} must not contain SYSTEM_ALERT_WINDOW`
  );
  assert(
    findPermissionDeclarations(manifest, advertisingIdPermission).length === 0,
    `${relativeManifestPath} must not contain AD_ID`
  );
  assert(
    unexpectedPermissions.length === 0 && missingPermissions.length === 0,
    `${relativeManifestPath} permission surface differs from the approved baseline. ` +
      `Unexpected: ${unexpectedPermissions.join(", ") || "none"}. ` +
      `Missing: ${missingPermissions.join(", ") || "none"}.`
  );
}

if (strings) {
  assert(
    strings.includes('<string name="app_name">Moodinator</string>'),
    "Android app_name must be Moodinator"
  );
}

console.log("Android release config checks passed.");
