const { mkdirSync, mkdtempSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");

const { assertInstalledQaBuild, evidenceAcceptance, evidenceStatus, isToolUnavailable, requireSourceSha } = require("./native-qa-common");
const { runDeleteUndoAcceptance } = require("./native-qa-runner");

const appId = "com.lab4code.moodinator.qa";
const root = path.resolve(__dirname, "..");

function parseOptions(argv) {
  const serial = argv.shift();
  if (!serial || !/^emulator-\d+$/.test(serial)) {
    throw new Error("Usage: bun run qa:smoke -- emulator-5554 [--out /tmp/evidence]");
  }
  let output = null;
  while (argv.length) {
    const flag = argv.shift();
    if (flag !== "--out") throw new Error(`Unknown option ${flag}.`);
    output = argv.shift();
    if (!output) throw new Error("Missing value for --out.");
  }
  return { serial, output };
}

function writeEvidence(outputDirectory, evidence) {
  writeFileSync(path.join(outputDirectory, "smoke.json"), `${JSON.stringify(evidence, null, 2)}\n`);
}

async function main(argv = process.argv.slice(2)) {
  const options = parseOptions(argv);
  const sourceSha = requireSourceSha();
  const outputDirectory = options.output
    ? path.resolve(options.output)
    : mkdtempSync(path.join(tmpdir(), "moodinator-native-smoke-"));
  mkdirSync(outputDirectory, { recursive: true });

  const baseEvidence = {
    appId,
    serial: options.serial,
    sourceSha,
    journey: ".maestro/smoke.yaml",
    fabricatedDataOnly: true,
  };

  try {
    await assertInstalledQaBuild(options.serial, sourceSha);
    const result = await runDeleteUndoAcceptance(
      options.serial,
      ".maestro/smoke.yaml",
      {
        cwd: root,
        target: { note: "QA smoke edited note", mood: 5 },
        waitOptions: {
          dumpTimeoutMs: 300,
          undoDumpTimeoutMs: 300,
          undoPollIntervalMs: 35,
        },
      },
    );
    const evidence = {
      ...baseEvidence,
      status: "passed",
      acceptance: "accepted",
      beforeDelete: result.identity,
      afterDelete: { visibleActionableExactIdentityAbsent: true },
      restored: { exactIdentity: result.identity, exactlyOne: true },
      deleteTap: result.delete.point,
      undoTap: result.undo.point,
      coordination: result.coordination,
    };
    writeEvidence(outputDirectory, evidence);
    console.log(`Native smoke evidence: ${outputDirectory}`);
    console.log(`Undo restored ${result.identity.note} exactly once at timestamp ${result.identity.timestamp}.`);
  } catch (error) {
    const status = isToolUnavailable(error) ? "blocked" : "failed";
    writeEvidence(outputDirectory, {
      ...baseEvidence,
      status,
      acceptance: evidenceAcceptance(status),
      error: error.message,
    });
    throw error;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { parseOptions, main };
