const { spawn } = require("node:child_process");

const {
  dumpUiHierarchy,
  findNodes,
  normalizeResourceId,
  parseUiHierarchy,
  tapNode,
  waitForNode,
  waitForNodeAbsent,
  waitForNodeCount,
} = require("./native-ui");
const {
  coordinationRemainingMs,
  createUndoCoordination,
  transitionUndoCoordination,
} = require("./native-qa-coordination");

const undoMatcher = {
  description: "the transient Undo control",
  anyOf: [
    { testId: "undo-delete" },
    { contentDescription: "Undo delete" },
  ],
};

const deleteMatcher = {
  description: "the Delete entry action",
  text: "Delete entry",
};

const DEFAULT_MAESTRO_TIMEOUT_MS = 120000;
const DEFAULT_RESTORATION_TIMEOUT_MS = 4000;

function runMaestro(serial, flowPath, {
  cwd,
  timeoutMs = DEFAULT_MAESTRO_TIMEOUT_MS,
  command = "maestro",
} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, ["--device", serial, "test", flowPath], {
      cwd,
      stdio: "inherit",
    });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`Maestro exceeded its ${timeoutMs}ms timeout.`));
    }, timeoutMs);

    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Maestro exited ${code ?? `from ${signal}`}.`));
        return;
      }
      resolve({ code, signal });
    });
  });
}

function readHierarchy(serial, options = {}) {
  return parseUiHierarchy(dumpUiHierarchy(serial, options));
}

function entrySelectors(identity) {
  return [
    { testId: `mood-entry-stable-${identity.timestamp}` },
    {
      allOf: [
        { testId: `mood-entry-note-${identity.timestamp}` },
        { text: identity.note },
      ],
    },
    {
      allOf: [
        { testId: `mood-entry-rating-${identity.timestamp}` },
        { text: String(identity.mood) },
      ],
    },
  ];
}

function timestampFromNode(node) {
  const testId = normalizeResourceId(node["resource-id"]);
  const match = /mood-entry-note-(\d+)$/.exec(testId);
  return match ? Number(match[1]) : null;
}

function captureEntryIdentity(serial, {
  note,
  mood,
  timestamp = null,
  originalNote = null,
  entryIndex = null,
  adbPath = "adb",
  dumpTimeoutMs,
} = {}) {
  if (!note || !Number.isInteger(mood)) {
    throw new Error("An exact entry note and mood are required before deletion.");
  }

  const nodes = readHierarchy(serial, { adbPath, timeoutMs: dumpTimeoutMs });
  const noteMatcher = {
    allOf: [
      { testIdPrefix: "mood-entry-note-" },
      { text: note },
    ],
  };
  const noteNodes = findNodes(nodes, noteMatcher);
  if (noteNodes.length !== 1) {
    throw new Error(`Expected exactly one visible entry note ${JSON.stringify(note)}, found ${noteNodes.length}.`);
  }

  const observedTimestamp = timestamp ?? timestampFromNode(noteNodes[0]);
  if (!Number.isSafeInteger(observedTimestamp)) {
    throw new Error("The exact entry note did not expose a timestamp-based test identity.");
  }
  if (timestamp !== null && observedTimestamp !== timestamp) {
    throw new Error(`Expected entry timestamp ${timestamp}, observed ${observedTimestamp}.`);
  }

  const identity = {
    timestamp: observedTimestamp,
    note,
    mood,
    ...(originalNote ? { originalNote } : {}),
    ...(Number.isInteger(entryIndex) ? { entryIndex } : {}),
  };
  const selectors = entrySelectors(identity);
  const counts = selectors.map((matcher) => findNodes(nodes, matcher).length);
  if (counts.some((count) => count !== 1)) {
    throw new Error(`Entry identity was not unique before deletion (counts: ${counts.join(", ")}).`);
  }
  return { ...identity, selectors };
}

async function waitForEntryState(serial, identity, expectedCount, {
  timeoutMs,
  ...options
} = {}) {
  const deadline = Date.now() + timeoutMs;
  for (const matcher of identity.selectors) {
    const remaining = Math.max(0, deadline - Date.now());
    await waitForNodeCount(serial, matcher, expectedCount, {
      ...options,
      timeoutMs: remaining,
      // Count hidden/disabled stale nodes as well. A recycled row that has
      // not fully left the hierarchy must not satisfy either absence or the
      // exactly-one restoration assertion.
      includeHidden: true,
    });
  }
}

async function waitForExactEntry(serial, identity, options = {}) {
  await waitForEntryState(serial, identity, 1, options);
}

async function waitForEntryAbsent(serial, identity, options = {}) {
  await waitForEntryState(serial, identity, 0, options);
}

function transition(state, event) {
  return transitionUndoCoordination(state, event, Date.now());
}

/**
 * Run the Maestro preparation flow, then coordinate deletion and Undo from the
 * native hierarchy. The probe is deliberately not started until Maestro has
 * completed at the open action menu and the target identity has been captured.
 */
async function runDeleteUndoAcceptance(serial, flowPath, {
  cwd,
  target,
  waitOptions = {},
  maestroTimeoutMs = DEFAULT_MAESTRO_TIMEOUT_MS,
  undoWindowMs,
  deleteAbsenceTimeoutMs,
  restorationTimeoutMs = DEFAULT_RESTORATION_TIMEOUT_MS,
} = {}) {
  let coordination = createUndoCoordination({
    undoWindowMs,
    deleteAbsenceTimeoutMs,
    restorationTimeoutMs,
  });

  await runMaestro(serial, flowPath, { cwd, timeoutMs: maestroTimeoutMs });
  coordination = transition(coordination, "maestro-complete");

  const identity = captureEntryIdentity(serial, {
    ...target,
    adbPath: waitOptions.adbPath,
    dumpTimeoutMs: waitOptions.dumpTimeoutMs,
  });
  coordination = transition(coordination, "target-captured");

  // A prior toast would make an early hierarchy match a false positive. It must
  // be absent before this deletion begins.
  await waitForNodeAbsent(serial, undoMatcher, {
    ...waitOptions,
    timeoutMs: Math.min(waitOptions.preDeleteUndoTimeoutMs ?? 1000, 1000),
  });

  const deleteNode = await waitForNode(serial, deleteMatcher, {
    ...waitOptions,
    timeoutMs: waitOptions.deleteTimeoutMs ?? 3000,
  });
  const deleteTap = tapNode(serial, deleteNode, waitOptions);
  coordination = transition(coordination, "delete-requested");

  await waitForEntryAbsent(serial, identity, {
    ...waitOptions,
    timeoutMs: coordinationRemainingMs(coordination),
  });
  coordination = transition(coordination, "target-absent");

  const undoNode = await waitForNode(serial, undoMatcher, {
    ...waitOptions,
    timeoutMs: coordinationRemainingMs(coordination),
    pollIntervalMs: waitOptions.undoPollIntervalMs ?? 35,
    dumpTimeoutMs: waitOptions.undoDumpTimeoutMs ?? waitOptions.dumpTimeoutMs,
  });
  coordination = transition(coordination, "undo-visible");
  const undoTap = tapNode(serial, undoNode, waitOptions);
  coordination = transition(coordination, "undo-tapped");

  await waitForExactEntry(serial, identity, {
    ...waitOptions,
    timeoutMs: coordinationRemainingMs(coordination),
  });
  coordination = transition(coordination, "target-restored");

  return {
    coordination,
    identity,
    delete: { node: deleteNode, ...deleteTap },
    undo: { node: undoNode, ...undoTap },
  };
}

module.exports = {
  DEFAULT_MAESTRO_TIMEOUT_MS,
  captureEntryIdentity,
  deleteMatcher,
  entrySelectors,
  readHierarchy,
  runDeleteUndoAcceptance,
  runMaestro,
  timestampFromNode,
  undoMatcher,
  waitForEntryAbsent,
  waitForExactEntry,
};
