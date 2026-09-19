const { spawn } = require("node:child_process");

const { waitForNodeAndTap } = require("./native-ui");

const undoMatcher = {
  description: "the transient Undo control",
  anyOf: [
    { testId: "undo-delete" },
    { contentDescription: "Undo delete" },
  ],
};

function runMaestro(serial, flowPath, { cwd }) {
  return new Promise((resolve, reject) => {
    const child = spawn("maestro", ["--device", serial, "test", flowPath], {
      cwd,
      stdio: "inherit",
    });
    let settled = false;

    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    child.once("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      if (code !== 0) {
        reject(new Error(`Maestro exited ${code ?? `from ${signal}`}.`));
        return;
      }
      resolve({ code, signal });
    });
  });
}

async function runMaestroAndTapUndo(serial, flowPath, {
  cwd,
  waitOptions,
} = {}) {
  const child = spawn("maestro", ["--device", serial, "test", flowPath], {
    cwd,
    stdio: "inherit",
  });
  const maestroResult = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });

  try {
    // Start polling before Maestro reaches Delete entry. This is the critical
    // timing boundary: the probe can act during Maestro's final settle window.
    const undo = await waitForNodeAndTap(serial, undoMatcher, waitOptions);
    const result = await maestroResult;
    if (result.code !== 0) {
      throw new Error(`Maestro exited ${result.code ?? `from ${result.signal}`}.`);
    }
    return undo;
  } catch (error) {
    child.kill("SIGTERM");
    await maestroResult.catch(() => undefined);
    throw error;
  }
}

module.exports = { runMaestro, runMaestroAndTapUndo, undoMatcher };
