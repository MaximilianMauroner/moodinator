const { chmodSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const QA_SOURCE_METADATA = ".moodinator-qa-source.json";
const FULL_SHA = /^[0-9a-f]{40}$/;

function metadataPath(workspace) {
  return path.join(workspace, QA_SOURCE_METADATA);
}

function writePreparedSourceMetadata(workspace, sourceSha) {
  if (!FULL_SHA.test(sourceSha)) throw new Error(`Invalid prepared source SHA: ${sourceSha}`);
  const filePath = metadataPath(workspace);
  writeFileSync(filePath, `${JSON.stringify({ version: 1, sourceSha }, null, 2)}\n`, { flag: "wx", mode: 0o444 });
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
  if (metadata?.version !== 1 || !FULL_SHA.test(metadata?.sourceSha ?? "")) {
    throw new Error(`Prepared source metadata at ${filePath} is invalid.`);
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
