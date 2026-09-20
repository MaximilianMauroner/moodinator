const { spawn } = require("node:child_process");

const {
  dumpUiHierarchy,
  findNodes,
  normalizeResourceId,
  parseUiHierarchy,
  tapNode,
  waitForNode,
  waitForNodeHierarchyGone,
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

function assertCoordinationPassed(coordination) {
  if (coordination.phase !== "passed") {
    throw new Error(coordination.failure || `Undo coordination ended in ${coordination.phase}.`);
  }
  return coordination;
}

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

function entryIdentityCounts(nodes, identity) {
  return {
    visible: identity.selectors.map((matcher) => findNodes(nodes, matcher).length),
    hierarchy: identity.selectors.map((matcher) => findNodes(nodes, matcher, { includeHidden: true }).length),
  };
}

/**
 * Restoration is accepted only when one actionable row is present and the
 * hierarchy contains no second stale copy of any exact identity selector.
 * Keeping these scopes separate prevents a hidden recycled row from being
 * mistaken for the restored entry while still making the absence semantics
 * explicit for callers that only need visible removal.
 */
function isExactlyOneRestoredEntry(nodes, identity) {
  const counts = entryIdentityCounts(nodes, identity);
  return counts.visible.every((count) => count === 1)
    && counts.hierarchy.every((count) => count === 1);
}

async function waitForEntryState(serial, identity, expectedCount, {
  timeoutMs = DEFAULT_RESTORATION_TIMEOUT_MS,
  scope = "visible",
  ...options
} = {}) {
  if (scope !== "visible" && scope !== "hierarchy") {
    throw new Error(`Unknown entry hierarchy scope: ${scope}.`);
  }
  const includeHidden = scope === "hierarchy";
  const deadline = Date.now() + timeoutMs;
  for (const matcher of identity.selectors) {
    const remaining = Math.max(0, deadline - Date.now());
    await waitForNodeCount(serial, matcher, expectedCount, {
      ...options,
      timeoutMs: remaining,
      includeHidden,
    });
  }
}

async function waitForExactEntry(serial, identity, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_RESTORATION_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  await waitForEntryState(serial, identity, 1, {
    ...options,
    scope: "visible",
    timeoutMs: Math.max(0, deadline - Date.now()),
  });
  await waitForEntryState(serial, identity, 1, {
    ...options,
    scope: "hierarchy",
    timeoutMs: Math.max(0, deadline - Date.now()),
  });
}

async function waitForEntryVisibleAbsent(serial, identity, options = {}) {
  await waitForEntryState(serial, identity, 0, {
    ...options,
    scope: "visible",
  });
}

async function waitForEntryHierarchyGone(serial, identity, options = {}) {
  await waitForEntryState(serial, identity, 0, {
    ...options,
    scope: "hierarchy",
  });
}

async function waitForEntryAbsent(serial, identity, options = {}) {
  await waitForEntryVisibleAbsent(serial, identity, options);
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
  await waitForNodeHierarchyGone(serial, undoMatcher, {
    ...waitOptions,
    timeoutMs: Math.min(waitOptions.preDeleteUndoTimeoutMs ?? 1000, 1000),
  });

  const deleteNode = await waitForNode(serial, deleteMatcher, {
    ...waitOptions,
    timeoutMs: waitOptions.deleteTimeoutMs ?? 3000,
  });
  const deleteTap = tapNode(serial, deleteNode, waitOptions);
  coordination = transition(coordination, "delete-requested");

  await waitForEntryVisibleAbsent(serial, identity, {
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
  assertCoordinationPassed(coordination);

  return {
    coordination,
    identity,
    delete: { node: deleteNode, ...deleteTap },
    undo: { node: undoNode, ...undoTap },
  };
}

module.exports = {
  DEFAULT_MAESTRO_TIMEOUT_MS,
  assertCoordinationPassed,
  captureEntryIdentity,
  deleteMatcher,
  entryIdentityCounts,
  entrySelectors,
  isExactlyOneRestoredEntry,
  readHierarchy,
  runDeleteUndoAcceptance,
  runMaestro,
  timestampFromNode,
  undoMatcher,
  waitForEntryAbsent,
  waitForEntryHierarchyGone,
  waitForExactEntry,
  waitForEntryVisibleAbsent,
};
