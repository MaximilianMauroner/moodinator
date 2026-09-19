const { spawnSync } = require("node:child_process");

const DEFAULT_DUMP_TIMEOUT_MS = 800;
const DEFAULT_POLL_INTERVAL_MS = 80;
const DEFAULT_WAIT_TIMEOUT_MS = 4500;

function decodeXmlEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#(x[\da-f]+|\d+);/gi, (_match, code) => {
      const radix = code[0].toLowerCase() === "x" ? 16 : 10;
      const digits = code[0].toLowerCase() === "x" ? code.slice(1) : code;
      const point = Number.parseInt(digits, radix);
      return Number.isNaN(point) ? _match : String.fromCodePoint(point);
    });
}

function parseAttributes(tag) {
  const attributes = {};
  const attributePattern = /([:\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g;
  let match;

  while ((match = attributePattern.exec(tag)) !== null) {
    attributes[match[1]] = decodeXmlEntities(match[3]);
  }

  return attributes;
}

/**
 * Parse the node records emitted by Android's uiautomator dump command.
 * Keeping this parser dependency-free lets the QA runner work before the app
 * dependency tree has been installed and makes its selector behavior testable.
 */
function parseUiHierarchy(xml) {
  const nodes = [];
  const nodePattern = /<node\b[^>]*\/?\s*>/g;
  let match;

  while ((match = nodePattern.exec(xml)) !== null) {
    const attributes = parseAttributes(match[0]);
    if (Object.keys(attributes).length > 0) nodes.push(attributes);
  }

  return nodes;
}

function parseBounds(bounds) {
  const match = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(bounds ?? "");
  if (!match) return null;

  const [, left, top, right, bottom] = match.map(Number);
  if (right <= left || bottom <= top) return null;

  return { left, top, right, bottom };
}

function nodeCenter(node) {
  const bounds = parseBounds(node.bounds);
  if (!bounds) return null;

  return {
    x: Math.round((bounds.left + bounds.right) / 2),
    y: Math.round((bounds.top + bounds.bottom) / 2),
  };
}

function isVisibleAndEnabled(node) {
  return node["visible-to-user"] !== "false" && node.enabled !== "false";
}

function normalizeResourceId(resourceId) {
  if (!resourceId) return "";
  const marker = ":id/";
  const markerIndex = resourceId.lastIndexOf(marker);
  return markerIndex >= 0 ? resourceId.slice(markerIndex + marker.length) : resourceId;
}

function nodeMatches(node, matcher, { visibleOnly = true } = {}) {
  if (typeof matcher === "function") return matcher(node);
  if (!matcher || typeof matcher !== "object") return false;
  if (visibleOnly && !isVisibleAndEnabled(node)) return false;
  if (matcher.anyOf) return matcher.anyOf.some((alternative) => nodeMatches(node, alternative, { visibleOnly }));
  if (matcher.allOf) return matcher.allOf.every((alternative) => nodeMatches(node, alternative, { visibleOnly }));

  const testId = normalizeResourceId(node["resource-id"]);
  const text = node.text ?? "";
  const contentDescription = node["content-desc"] ?? "";
  const hasSelector = Boolean(
    matcher.testId || matcher.testIdPrefix || matcher.text !== undefined || matcher.contentDescription !== undefined,
  );

  if (matcher.testId && testId !== matcher.testId) return false;
  if (matcher.testIdPrefix && !testId.startsWith(matcher.testIdPrefix)) return false;
  if (matcher.text !== undefined) {
    if (matcher.contains ? !text.includes(matcher.text) : text !== matcher.text) return false;
  }
  if (matcher.contentDescription !== undefined) {
    if (matcher.contains
      ? !contentDescription.includes(matcher.contentDescription)
      : contentDescription !== matcher.contentDescription) return false;
  }

  return hasSelector;
}

function findNodes(nodes, matcher, { includeHidden = false } = {}) {
  return nodes.filter((node) => nodeMatches(node, matcher, { visibleOnly: !includeHidden }));
}

function findNodeByTestId(nodes, testId) {
  return findNodes(nodes, { testId })[0] ?? null;
}

function findNodeByTestIdPrefix(nodes, prefix) {
  return findNodes(nodes, { testIdPrefix: prefix })[0] ?? null;
}

function findNodeByText(nodes, text, { contains = false } = {}) {
  return findNodes(nodes, { text, contains })[0] ?? null;
}

function findNodeByContentDescription(nodes, contentDescription, { contains = false } = {}) {
  return findNodes(nodes, { contentDescription, contains })[0] ?? null;
}

function describeMatcher(matcher) {
  if (typeof matcher === "string") return `testID ${matcher}`;
  return matcher.description ?? "requested native control";
}

function matchNode(nodes, matcher) {
  return findNodes(nodes, matcher)[0] ?? null;
}

function runAdb(serial, args, {
  adbPath = "adb",
  timeoutMs = 5000,
  encoding = "utf8",
} = {}) {
  const result = spawnSync(adbPath, ["-s", serial, ...args], {
    encoding,
    maxBuffer: 8 * 1024 * 1024,
    timeout: timeoutMs,
  });

  if (result.error) {
    throw new Error(`adb ${args.join(" ")} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(`adb ${args.join(" ")} exited ${result.status}${detail ? `: ${detail}` : ""}`);
  }

  return result.stdout ?? "";
}

function dumpUiHierarchy(serial, {
  adbPath = "adb",
  timeoutMs = DEFAULT_DUMP_TIMEOUT_MS,
} = {}) {
  let result;
  try {
    result = spawnSync(
      adbPath,
      ["-s", serial, "shell", "uiautomator", "dump", "--compressed", "/dev/tty"],
      {
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
        timeout: timeoutMs,
      },
    );
  } catch (error) {
    throw new Error(`Unable to inspect Android UI: ${error.message}`);
  }

  if (result.error) {
    throw new Error(`Unable to inspect Android UI: ${result.error.message}`);
  }

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const start = output.indexOf("<hierarchy");
  const end = output.lastIndexOf("</hierarchy>");
  if (start < 0 || end < start) {
    const detail = output.replace(/\s+/g, " ").trim().slice(0, 240);
    throw new Error(`Android UI hierarchy was not returned${detail ? `: ${detail}` : ""}`);
  }

  return output.slice(start, end + "</hierarchy>".length);
}

async function waitForNode(serial, matcher, {
  adbPath = "adb",
  timeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  dumpTimeoutMs = DEFAULT_DUMP_TIMEOUT_MS,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  let unavailable = false;

  while (Date.now() <= deadline) {
    try {
      const xml = dumpUiHierarchy(serial, { adbPath, timeoutMs: dumpTimeoutMs });
      const nodes = parseUiHierarchy(xml);
      const node = matchNode(nodes, matcher);
      if (node) return node;
      unavailable ||= findNodes(nodes, matcher, { includeHidden: true }).length > 0;
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  const detail = lastError ? ` Last inspection error: ${lastError.message}` : "";
  if (unavailable) {
    throw new Error(`${describeMatcher(matcher)} was present but disabled or invisible before the deadline.${detail}`);
  }
  throw new Error(`Timed out waiting for ${describeMatcher(matcher)}.${detail}`);
}

async function waitForNodeCount(serial, matcher, expectedCount, {
  adbPath = "adb",
  timeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  dumpTimeoutMs = DEFAULT_DUMP_TIMEOUT_MS,
  includeHidden = false,
} = {}) {
  if (!Number.isInteger(expectedCount) || expectedCount < 0) {
    throw new Error("Expected native node count must be a non-negative integer.");
  }

  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  let lastCount = null;
  while (Date.now() <= deadline) {
    try {
      const nodes = parseUiHierarchy(dumpUiHierarchy(serial, { adbPath, timeoutMs: dumpTimeoutMs }));
      const matches = findNodes(nodes, matcher, { includeHidden });
      lastCount = matches.length;
      if (lastCount === expectedCount) return matches;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  const count = lastCount === null ? "unknown" : lastCount;
  const detail = lastError ? ` Last inspection error: ${lastError.message}` : "";
  throw new Error(
    `Timed out waiting for ${describeMatcher(matcher)} to have ${expectedCount} node(s); last count was ${count}.${detail}`,
  );
}

async function waitForNodeAbsent(serial, matcher, options = {}) {
  await waitForNodeCount(serial, matcher, 0, { includeHidden: true, ...options });
}

function tapNode(serial, node, {
  adbPath = "adb",
  tapTimeoutMs = 3000,
} = {}) {
  const point = nodeCenter(node);
  if (!point) throw new Error("Native control did not expose usable bounds.");
  runAdb(serial, ["shell", "input", "tap", String(point.x), String(point.y)], {
    adbPath,
    timeoutMs: tapTimeoutMs,
  });
  return { node, point };
}

async function waitForNodeAndTap(serial, matcher, options = {}) {
  const node = await waitForNode(serial, matcher, options);
  try {
    return tapNode(serial, node, options);
  } catch (error) {
    throw new Error(`Unable to activate ${describeMatcher(matcher)}: ${error.message}`);
  }
}

function parseGfxInfo(output) {
  const numberAfter = (pattern) => {
    const value = output.match(pattern)?.[1];
    return value === undefined ? null : Number(value);
  };

  return {
    totalFrames: numberAfter(/Total frames rendered:\s*(\d+)/i),
    jankyFrames: numberAfter(/Janky frames:\s*(\d+)/i),
    missedVsync: numberAfter(/Missed Vsync:\s*(\d+)/i),
    highInputLatency: numberAfter(/High input latency:\s*(\d+)/i),
    slowUIThread: numberAfter(/Slow UI thread:\s*(\d+)/i),
    slowBitmapUploads: numberAfter(/Slow bitmap uploads:\s*(\d+)/i),
    slowDraw: numberAfter(/Slow issue draw commands:\s*(\d+)/i),
    jankyPercent: Number(output.match(/Janky frames:\s*\d+\s*\(([\d.]+)%\)/i)?.[1] ?? NaN),
  };
}

function parseMemInfo(output) {
  const numberAfter = (pattern) => {
    const value = output.match(pattern)?.[1];
    return value === undefined ? null : Number(value.replace(/,/g, ""));
  };

  return {
    totalPssKb: numberAfter(/^\s*TOTAL(?:\s+PSS)?\s*:?\s*([\d,]+)/m),
    dalvikHeapKb: numberAfter(/^\s*Dalvik Heap\s*:?\s*([\d,]+)/m),
    nativeHeapKb: numberAfter(/^\s*Native Heap\s*:?\s*([\d,]+)/m),
    javaHeapKb: numberAfter(/^\s*Java Heap\s*:?\s*([\d,]+)/m),
  };
}

module.exports = {
  DEFAULT_DUMP_TIMEOUT_MS,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_WAIT_TIMEOUT_MS,
  decodeXmlEntities,
  dumpUiHierarchy,
  findNodeByContentDescription,
  findNodeByTestId,
  findNodeByTestIdPrefix,
  findNodeByText,
  findNodes,
  nodeMatches,
  nodeCenter,
  normalizeResourceId,
  parseBounds,
  parseGfxInfo,
  parseMemInfo,
  parseUiHierarchy,
  runAdb,
  tapNode,
  waitForNode,
  waitForNodeAbsent,
  waitForNodeCount,
  waitForNodeAndTap,
};
