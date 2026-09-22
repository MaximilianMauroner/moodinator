const COORDINATION_PHASES = Object.freeze({
  IDLE: "idle",
  DELETE_READY: "delete-ready",
  TARGET_READY: "target-ready",
  AWAITING_DELETE_ABSENCE: "awaiting-delete-absence",
  AWAITING_UNDO: "awaiting-undo",
  UNDO_VISIBLE: "undo-visible",
  AWAITING_RESTORATION: "awaiting-restoration",
  PASSED: "passed",
  FAILED: "failed",
});

const DEFAULT_UNDO_WINDOW_MS = 5000;
const DEFAULT_DELETE_ABSENCE_TIMEOUT_MS = 1200;
const DEFAULT_RESTORATION_TIMEOUT_MS = 4000;

function assertTimestamp(timestamp) {
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Undo coordination requires a finite timestamp, received ${timestamp}.`);
  }
}

function createUndoCoordination({
  now = Date.now(),
  undoWindowMs = DEFAULT_UNDO_WINDOW_MS,
  deleteAbsenceTimeoutMs = DEFAULT_DELETE_ABSENCE_TIMEOUT_MS,
  restorationTimeoutMs = DEFAULT_RESTORATION_TIMEOUT_MS,
} = {}) {
  assertTimestamp(now);
  for (const [label, value] of [
    ["undoWindowMs", undoWindowMs],
    ["deleteAbsenceTimeoutMs", deleteAbsenceTimeoutMs],
    ["restorationTimeoutMs", restorationTimeoutMs],
  ]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${label} must be a positive finite duration.`);
    }
  }

  return {
    phase: COORDINATION_PHASES.IDLE,
    updatedAt: now,
    deleteStartedAt: null,
    undoDeadline: null,
    deleteAbsenceDeadline: null,
    restorationDeadline: null,
    undoWindowMs,
    deleteAbsenceTimeoutMs,
    restorationTimeoutMs,
    history: [],
  };
}

function failCoordination(state, reason, at) {
  assertTimestamp(at);
  return {
    ...state,
    phase: COORDINATION_PHASES.FAILED,
    updatedAt: at,
    failure: reason,
    history: [...state.history, { event: "failed", at, reason }],
  };
}

function transitionUndoCoordination(state, event, at = Date.now()) {
  assertTimestamp(at);
  if (at < state.updatedAt) {
    throw new Error("Undo coordination timestamps must be monotonic.");
  }
  if (state.phase === COORDINATION_PHASES.PASSED || state.phase === COORDINATION_PHASES.FAILED) {
    throw new Error(`Undo coordination is already ${state.phase}.`);
  }

  const record = (phase, extra = {}) => ({
    ...state,
    ...extra,
    phase,
    updatedAt: at,
    history: [...state.history, { event, at }],
  });

  switch (`${state.phase}:${event}`) {
    case `${COORDINATION_PHASES.IDLE}:maestro-complete`:
      return record(COORDINATION_PHASES.DELETE_READY);
    case `${COORDINATION_PHASES.DELETE_READY}:target-captured`:
      return record(COORDINATION_PHASES.TARGET_READY);
    case `${COORDINATION_PHASES.TARGET_READY}:delete-requested`:
      return record(COORDINATION_PHASES.AWAITING_DELETE_ABSENCE, {
        deleteStartedAt: at,
        undoDeadline: at + state.undoWindowMs,
        deleteAbsenceDeadline: at + Math.min(
          state.deleteAbsenceTimeoutMs,
          state.undoWindowMs,
        ),
      });
    case `${COORDINATION_PHASES.AWAITING_DELETE_ABSENCE}:target-absent`:
      if (at > state.deleteAbsenceDeadline) {
        return failCoordination(state, "The deleted entry did not disappear before the Undo window.", at);
      }
      return record(COORDINATION_PHASES.AWAITING_UNDO);
    case `${COORDINATION_PHASES.AWAITING_UNDO}:undo-visible`:
      if (at > state.undoDeadline) {
        return failCoordination(state, "The transient Undo control appeared after its deadline.", at);
      }
      return record(COORDINATION_PHASES.UNDO_VISIBLE);
    case `${COORDINATION_PHASES.UNDO_VISIBLE}:undo-tapped`:
      if (at > state.undoDeadline) {
        return failCoordination(state, "Undo was tapped after its deadline.", at);
      }
      return record(COORDINATION_PHASES.AWAITING_RESTORATION, {
        restorationDeadline: at + state.restorationTimeoutMs,
      });
    case `${COORDINATION_PHASES.AWAITING_RESTORATION}:target-restored`:
      if (at > state.restorationDeadline) {
        return failCoordination(state, "The exact deleted entry was not restored before the deadline.", at);
      }
      return record(COORDINATION_PHASES.PASSED);
    default:
      throw new Error(`Invalid Undo coordination transition: ${state.phase} + ${event}.`);
  }
}

function coordinationRemainingMs(state, now = Date.now()) {
  assertTimestamp(now);
  const deadline = state.phase === COORDINATION_PHASES.AWAITING_DELETE_ABSENCE
    ? state.deleteAbsenceDeadline
    : state.phase === COORDINATION_PHASES.AWAITING_UNDO || state.phase === COORDINATION_PHASES.UNDO_VISIBLE
      ? state.undoDeadline
      : state.phase === COORDINATION_PHASES.AWAITING_RESTORATION
        ? state.restorationDeadline
        : null;
  const deadlines = deadline === null ? [] : [deadline];
  if (deadlines.length === 0) return null;
  return Math.max(0, Math.min(...deadlines) - now);
}

module.exports = {
  COORDINATION_PHASES,
  DEFAULT_DELETE_ABSENCE_TIMEOUT_MS,
  DEFAULT_RESTORATION_TIMEOUT_MS,
  DEFAULT_UNDO_WINDOW_MS,
  coordinationRemainingMs,
  createUndoCoordination,
  transitionUndoCoordination,
};
