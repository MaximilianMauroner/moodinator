const SOURCE_SHA_ENV = "MOODINATOR_SOURCE_SHA";

function requireSourceSha(env = process.env) {
  const value = env[SOURCE_SHA_ENV];
  if (!value || !/^[0-9a-f]{40}$/.test(value)) {
    throw new Error(
      `${SOURCE_SHA_ENV} is required and must be the full 40-character lowercase source SHA from the originating checkout. ` +
      `Run: export ${SOURCE_SHA_ENV}="$(git rev-parse HEAD)"`,
    );
  }
  return value;
}

function isToolUnavailable(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /ENOENT|not found|cannot find|no such file|not installed/i.test(message);
}

function evidenceStatus({ routeError = null, requiredFailures = [] } = {}) {
  if (routeError && isToolUnavailable(routeError)) return "blocked";
  if (requiredFailures.some((failure) => failure.status === "blocked")) return "blocked";
  if (routeError || requiredFailures.length > 0) return "failed";
  return "passed";
}

function evidenceAcceptance(status) {
  return status === "passed" ? "accepted" : "not-accepted";
}

module.exports = {
  SOURCE_SHA_ENV,
  evidenceAcceptance,
  evidenceStatus,
  isToolUnavailable,
  requireSourceSha,
};
