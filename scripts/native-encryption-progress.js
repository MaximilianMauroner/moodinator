function createRecoveryProgressTracker(caseName) {
  const phases = [
    "launch",
    `running:${caseName}:first-verification`,
    `running:${caseName}:second-verification`,
    "complete",
  ];
  let current = -1;

  return {
    observe(progress) {
      const next = phases.indexOf(progress);
      if (next < 0) throw new Error(`Unexpected native recovery progress: ${progress}`);
      if (next < current) throw new Error(`Native recovery progress moved backwards: ${progress}`);
      const changed = next > current;
      current = next;
      return { changed, complete: progress === "complete" };
    },
  };
}

function recoveryDeadlineRemaining(now, hardDeadline, stallDeadline) {
  return Math.max(0, Math.min(hardDeadline, stallDeadline) - now);
}

function recoveryReadTimeout(now, hardDeadline, stallDeadline, maximum = 3000) {
  const remaining = recoveryDeadlineRemaining(now, hardDeadline, stallDeadline);
  return remaining > 0 ? Math.min(maximum, remaining) : null;
}

module.exports = { createRecoveryProgressTracker, recoveryDeadlineRemaining, recoveryReadTimeout };
