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

function findNodeByTestId(nodes, testId) {
  return nodes.find(
    (node) =>
      isVisibleAndEnabled(node) &&
      normalizeResourceId(node["resource-id"]) === testId
  ) ?? null;
}

function findNodeByTestIdPrefix(nodes, prefix) {
  return nodes.find(
    (node) =>
      isVisibleAndEnabled(node) &&
      normalizeResourceId(node["resource-id"]).startsWith(prefix)
  ) ?? null;
}

function findNodeByText(nodes, text, { contains = false } = {}) {
  return nodes.find((node) => {
    if (!isVisibleAndEnabled(node)) return false;
    const value = node.text ?? "";
    return contains ? value.includes(text) : value === text;
  }) ?? null;
}

function findNodeByContentDescription(nodes, contentDescription, { contains = false } = {}) {
  return nodes.find((node) => {
    if (!isVisibleAndEnabled(node)) return false;
    const value = node["content-desc"] ?? "";
    return contains ? value.includes(contentDescription) : value === contentDescription;
  }) ?? null;
}

function describeMatcher(matcher) {
  if (typeof matcher === "string") return `testID ${matcher}`;
  return matcher.description ?? "requested native control";
}

function matchNode(nodes, matcher) {
  if (typeof matcher === "function") return nodes.find(matcher) ?? null;
  if (matcher.anyOf) {
    for (const alternative of matcher.anyOf) {
      const node = matchNode(nodes, alternative);
      if (node) return node;
    }
    return null;
  }
  if (matcher.testId) return findNodeByTestId(nodes, matcher.testId);
  if (matcher.testIdPrefix) return findNodeByTestIdPrefix(nodes, matcher.testIdPrefix);
  if (matcher.text) return findNodeByText(nodes, matcher.text, matcher);
  if (matcher.contentDescription) {
    return findNodeByContentDescription(nodes, matcher.contentDescription, matcher);
  }
  return null;
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

  while (Date.now() <= deadline) {
    try {
      const xml = dumpUiHierarchy(serial, { adbPath, timeoutMs: dumpTimeoutMs });
      const node = matchNode(parseUiHierarchy(xml), matcher);
      if (node) return node;
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  const detail = lastError ? ` Last inspection error: ${lastError.message}` : "";
  throw new Error(`Timed out waiting for ${describeMatcher(matcher)}.${detail}`);
}

async function waitForNodeAndTap(serial, matcher, options = {}) {
  const node = await waitForNode(serial, matcher, options);
  const point = nodeCenter(node);
  if (!point) {
    throw new Error(`Native control ${describeMatcher(matcher)} did not expose usable bounds.`);
  }

  runAdb(serial, ["shell", "input", "tap", String(point.x), String(point.y)], {
    adbPath: options.adbPath,
    timeoutMs: options.tapTimeoutMs ?? 3000,
  });

  return { node, point };
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
  nodeCenter,
  normalizeResourceId,
  parseBounds,
  parseGfxInfo,
  parseMemInfo,
  parseUiHierarchy,
  runAdb,
  waitForNode,
  waitForNodeAndTap,
};
