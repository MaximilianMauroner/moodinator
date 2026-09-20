const { createHash } = require("node:crypto");
const { chmodSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const QA_SOURCE_METADATA = ".moodinator-qa-source.json";
const FULL_SHA = /^[0-9a-f]{40}$/;

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
  writeFileSync(filePath, `${JSON.stringify({ version: 2, sourceSha, files }, null, 2)}\n`, { flag: "wx", mode: 0o444 });
  chmodSync(filePath, 0o444);
  return filePath;
}

function readPreparedSourceSha(workspace, env = process.env) {
  const filePath = metadataPath(workspace);
  let metadata;
  try {
    metadata = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`QA builds require prepared source metadata at ${filePath}: ${error.message}`);
  }
  if (metadata?.version !== 2 || !FULL_SHA.test(metadata?.sourceSha ?? "")
    || !metadata.files || Array.isArray(metadata.files) || typeof metadata.files !== "object") {
    throw new Error(`Prepared source metadata at ${filePath} is invalid.`);
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
  writePreparedSourceMetadata,
};
