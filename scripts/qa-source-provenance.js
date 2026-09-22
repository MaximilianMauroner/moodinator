const { createHash } = require("node:crypto");
const { chmodSync, readdirSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const QA_SOURCE_METADATA = ".moodinator-qa-source.json";
const FULL_SHA = /^[0-9a-f]{40}$/;
const GENERATED_FILES = new Set(["expo-env.d.ts", "android/local.properties"]);
const GENERATED_PREFIXES = [
  "node_modules/",
  ".expo/",
  "android/.gradle/",
  "android/.kotlin/",
  "android/build/",
  "android/app/build/",
  "android/app/.cxx/",
];

function isGeneratedPath(relativePath) {
  return GENERATED_FILES.has(relativePath)
    || GENERATED_PREFIXES.some((item) => relativePath === item.slice(0, -1) || relativePath.startsWith(item));
}

function workspaceFiles(workspace) {
  const files = [];
  function visit(directory, prefix = "") {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (relativePath === QA_SOURCE_METADATA || isGeneratedPath(relativePath)) continue;
      const absolutePath = path.join(workspace, relativePath);
      if (entry.isDirectory()) visit(absolutePath, relativePath);
      else if (entry.isFile()) files.push(relativePath);
      else throw new Error(`Prepared QA workspace contains unsupported input ${relativePath}.`);
    }
  }
  visit(workspace);
  return files.sort();
}

function metadataPath(workspace) {
  return path.join(workspace, QA_SOURCE_METADATA);
}

function fileSha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function writePreparedSourceMetadata(workspace, sourceSha, trackedFiles) {
  if (!FULL_SHA.test(sourceSha)) throw new Error(`Invalid prepared source SHA: ${sourceSha}`);
  if (!Array.isArray(trackedFiles) || trackedFiles.length === 0) {
    throw new Error("Prepared source metadata requires the copied tracked-file manifest.");
  }
  const files = {};
  for (const relativePath of [...trackedFiles].sort()) {
    if (path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes("..")) {
      throw new Error(`Invalid prepared source path: ${relativePath}`);
    }
    files[relativePath] = fileSha256(path.join(workspace, relativePath));
  }
  const filePath = metadataPath(workspace);
  writeFileSync(filePath, `${JSON.stringify({ version: 3, sourceSha, files, nativeSealed: false }, null, 2)}\n`, { flag: "wx", mode: 0o444 });
  chmodSync(filePath, 0o444);
  return filePath;
}

function sealPreparedNativeSource(workspace) {
  const filePath = metadataPath(workspace);
  const metadata = JSON.parse(readFileSync(filePath, "utf8"));
  validateMetadata(filePath, metadata);
  if (metadata.nativeSealed) throw new Error("Prepared native source is already sealed.");
  const allFiles = workspaceFiles(workspace);
  const unexpected = allFiles.filter((file) => !Object.hasOwn(metadata.files, file) && !file.startsWith("android/"));
  if (unexpected.length) throw new Error(`Prepared QA workspace contains unexpected input ${unexpected[0]}.`);
  const nativeFiles = allFiles.filter((file) => file.startsWith("android/"));
  if (!nativeFiles.length) throw new Error("No generated Android source found; run the documented clean prebuild first.");
  for (const file of nativeFiles) metadata.files[file] = fileSha256(path.join(workspace, file));
  metadata.nativeSealed = true;
  chmodSync(filePath, 0o644);
  writeFileSync(filePath, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o444 });
  chmodSync(filePath, 0o444);
}

function validateMetadata(filePath, metadata) {
  if (metadata?.version !== 3 || !FULL_SHA.test(metadata?.sourceSha ?? "")
    || !metadata.files || Array.isArray(metadata.files) || typeof metadata.files !== "object"
    || typeof metadata.nativeSealed !== "boolean") {
    throw new Error(`Prepared source metadata at ${filePath} is invalid.`);
  }
}

function readPreparedSourceSha(workspace, env = process.env) {
  const filePath = metadataPath(workspace);
  let metadata;
  try {
    metadata = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`QA builds require prepared source metadata at ${filePath}: ${error.message}`);
  }
  validateMetadata(filePath, metadata);
  const prebuilding = env.MOODINATOR_QA_PREPARE_NATIVE === "1";
  if (metadata.nativeSealed && prebuilding) {
    throw new Error("MOODINATOR_QA_PREPARE_NATIVE may only be used before Android source is sealed.");
  }
  if (!metadata.nativeSealed && !prebuilding) {
    throw new Error("Prepared Android source is not sealed; run the documented clean prebuild and qa:seal-native first.");
  }
  for (const [relativePath, expectedHash] of Object.entries(metadata.files)) {
    if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes("..")) {
      throw new Error(`Prepared source metadata at ${filePath} contains an invalid path.`);
    }
    let actualHash;
    try {
      actualHash = fileSha256(path.join(workspace, relativePath));
    } catch (error) {
      throw new Error(`Prepared source file ${relativePath} is missing: ${error.message}`);
    }
    if (!/^[0-9a-f]{64}$/.test(expectedHash) || actualHash !== expectedHash) {
      throw new Error(
        `Prepared source file ${relativePath} differs from source ${metadata.sourceSha}; run qa:prepare again.`,
      );
    }
  }
  const unexpected = workspaceFiles(workspace).find((relativePath) => !Object.hasOwn(metadata.files, relativePath)
    && !(!metadata.nativeSealed && prebuilding && relativePath.startsWith("android/")));
  if (unexpected) throw new Error(`Prepared QA workspace contains unexpected input ${unexpected}.`);
  const requestedSha = env.MOODINATOR_SOURCE_SHA;
  if (requestedSha !== undefined && requestedSha !== metadata.sourceSha) {
    throw new Error(
      `MOODINATOR_SOURCE_SHA ${requestedSha} does not match prepared source ${metadata.sourceSha}.`,
    );
  }
  return metadata.sourceSha;
}

module.exports = {
  QA_SOURCE_METADATA,
  readPreparedSourceSha,
  sealPreparedNativeSource,
  writePreparedSourceMetadata,
};
