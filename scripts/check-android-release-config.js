const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const systemAlertWindowPermission = "android.permission.SYSTEM_ALERT_WINDOW";
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

const pkg = readJson("package.json");
const app = readJson("app.json");
const eas = readJson("eas.json");
const gradle = readOptionalText("android/app/build.gradle");
const mainManifest = readOptionalText("android/app/src/main/AndroidManifest.xml");
const strings = readOptionalText("android/app/src/main/res/values/strings.xml");

const productionAndroid = eas.build?.production?.android ?? {};
const androidPermissions = app.expo.android?.permissions ?? [];
const androidBlockedPermissions = app.expo.android?.blockedPermissions ?? [];

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
  !androidPermissions.includes(systemAlertWindowPermission),
  "app.json Android permissions must not request SYSTEM_ALERT_WINDOW"
);
assert(
  androidBlockedPermissions.includes(systemAlertWindowPermission),
  "app.json expo.android.blockedPermissions must include android.permission.SYSTEM_ALERT_WINDOW"
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
  const systemAlertWindowDeclarations = findPermissionDeclarations(
    mainManifest,
    systemAlertWindowPermission
  );

  assert(
    systemAlertWindowDeclarations.every(removesPermissionDuringMerge),
    "Main Android manifest may only declare SYSTEM_ALERT_WINDOW with tools:node=\"remove\""
  );
}

for (const manifestPath of findGeneratedReleaseManifests()) {
  const manifest = fs.readFileSync(manifestPath, "utf8");

  assert(
    findPermissionDeclarations(manifest, systemAlertWindowPermission).length === 0,
    `${path.relative(root, manifestPath)} must not contain SYSTEM_ALERT_WINDOW`
  );
}

if (strings) {
  assert(
    strings.includes('<string name="app_name">Moodinator</string>'),
    "Android app_name must be Moodinator"
  );
}

console.log("Android release config checks passed.");
