import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const eslint = new ESLint({ cwd: root });

const pre59Emotions = readFileSync(path.join(root, "tests/fixtures/pre-59-emotions.ts.txt"), "utf8");
const pre59AddEmotion = pre59Emotions.match(/export async function addEmotion\(emotion: Emotion\): Promise<void> \{.*?\n\}/s)?.[0];

const RAW = "The raw connection is private. Use readDb for queries or runInTransaction for writes.";
const SQLITE = "Only db/encryption/native.ts may import Expo SQLite at runtime. Use readDb for queries or runInTransaction for writes.";

async function boundaryMessages(file, code, linter = eslint) {
  const filePath = path.join(root, file);
  assert.equal(await linter.isPathIgnored(filePath), false, `${file} must not be ignored or unconfigured`);
  const config = await linter.calculateConfigForFile(filePath);
  assert.ok(config, `${file} must have an effective ESLint config`);
  assert.equal(config.rules?.["moodinator/db-boundaries"]?.[0], 2, `${file} must enable the boundary rule at error`);
  const results = await linter.lintText(code, { filePath });
  assert.equal(results.length, 1, `${file} must have one lint result`);
  const [result] = results;
  assert.deepEqual(
    result.messages.filter((message) => message.fatal || message.ruleId == null),
    [],
    `${file} must have no lint setup or fatal diagnostics`,
  );
  return result.messages
    .filter((message) => message.ruleId === "moodinator/db-boundaries")
    .map((message) => message.message);
}

function typeErrors(sources, configSystem = ts.sys) {
  const parsed = ts.getParsedCommandLineOfConfigFile(path.join(root, "tsconfig.json"), { noEmit: true }, {
    ...configSystem,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => assert.fail(`TypeScript config setup failed: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`),
  });
  assert.ok(parsed, "TypeScript config setup failed: no parsed config");
  assert.deepEqual(
    parsed.errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")),
    [],
    "TypeScript config setup failed",
  );
  const virtual = new Map(Object.entries(sources).map(([file, source]) => [path.join(root, file), source]));
  const host = ts.createCompilerHost(parsed.options);
  const { fileExists, getSourceFile } = host;
  host.fileExists = (name) => virtual.has(path.resolve(name)) || fileExists.call(host, name);
  host.getSourceFile = (name, languageVersion, ...rest) => virtual.has(path.resolve(name))
    ? ts.createSourceFile(name, virtual.get(path.resolve(name)), languageVersion, true)
    : getSourceFile.call(host, name, languageVersion, ...rest);
  const ambient = parsed.fileNames.filter((file) => file.endsWith(".d.ts"));
  const program = ts.createProgram({ rootNames: [...virtual.keys(), ...ambient], options: parsed.options, host });
  assert.deepEqual(
    program.getOptionsDiagnostics().map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")),
    [],
    "TypeScript option setup failed",
  );
  assert.deepEqual(
    program.getGlobalDiagnostics().map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")),
    [],
    "TypeScript global setup failed",
  );
  return Object.fromEntries([...virtual.keys()].map((file) => {
    const sourceFile = program.getSourceFile(file);
    assert.ok(sourceFile, `TypeScript source setup failed: ${file} is missing`);
    const diagnostics = [...program.getSyntacticDiagnostics(sourceFile), ...program.getSemanticDiagnostics(sourceFile)];
    return [path.relative(root, file), diagnostics.map((diagnostic) => {
      assert.equal(diagnostic.file, sourceFile, `${file} must own its diagnostic`);
      assert.ok(Number.isInteger(diagnostic.start), `${file} diagnostic must have a source position`);
      return {
        line: sourceFile.getLineAndCharacterOfPosition(diagnostic.start).line + 1,
        code: diagnostic.code,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
      };
    })];
  }));
}

for (const [name, options, expected] of [
  ["ignored", { overrideConfig: { ignores: ["db/moods/probe.ts"] } }, /must not be ignored or unconfigured/],
  ["unconfigured", { overrideConfigFile: true }, /must not be ignored or unconfigured/],
  ["missing rule", { overrideConfigFile: true, overrideConfig: { files: ["**/*.ts"] } }, /must enable the boundary rule at error/],
  ["disabled rule", { overrideConfig: { rules: { "moodinator/db-boundaries": "off" } } }, /must enable the boundary rule at error/],
  ["warning rule", { overrideConfig: { rules: { "moodinator/db-boundaries": "warn" } } }, /must enable the boundary rule at error/],
]) {
  test(`allowed lint probes reject ${name} setup`, async () => {
    const linter = new ESLint({ cwd: root, ...options });
    await assert.rejects(boundaryMessages("db/moods/probe.ts", 'import { readDb } from "../client";', linter), expected);
  });
}

test("positive type probes reject a recoverable config error", () => {
  const configFile = path.join(root, "tsconfig.json");
  assert.throws(() => typeErrors({ "db/moods/probe.ts": "export const allowed = true;" }, {
    ...ts.sys,
    readFile(file) {
      const source = ts.sys.readFile(file);
      if (path.resolve(file) !== configFile) return source;
      const config = JSON.parse(source);
      return JSON.stringify({ ...config, compilerOptions: { ...config.compilerOptions, p2InvalidOption: true } });
    },
  }), /TypeScript config setup failed[\s\S]*Unknown compiler option 'p2InvalidOption'/);
});

test("the fixture is the unchanged pre-#59 emotions module", () => {
  assert.equal(
    createHash("sha256").update(pre59Emotions).digest("hex"),
    "496e76672cd89e60032f8f53a17a35f630e3a53d69cb54344b7734bb82d570c1",
  );
  assert.ok(pre59AddEmotion?.includes("const db = await getDb();"), "old addEmotion reads the raw handle");
});

test("lint rejects the actual pre-#59 emotions module", async () => {
  assert.deepEqual(await boundaryMessages("db/moods/emotions.ts", pre59Emotions), [RAW]);
});

for (const [name, file, code, expected] of [
  ["alias namespace import", "src/services/probe.ts", 'import * as raw from "@db/client";', RAW],
  ["alias raw opener", "src/hooks/probe.ts", 'import { openDatabase } from "@db/client";', RAW],
  ["readDb beside the initializer", "src/services/probe.ts", 'import { readDb, initializeDatabase } from "@db/client";', RAW],
  ["default import", "db/moods/probe.ts", 'import client from "../client";', RAW],
  ["side-effect import", "db/moods/probe.ts", 'import "../client";', RAW],
  ["relative re-export with extension", "db/moods/probe.ts", 'export { openDatabase } from ".././client.ts";', RAW],
  ["re-export of the whole module", "db/moods/probe.ts", 'export * from "../client";', RAW],
  ["dynamic import", "db/moods/probe.ts", 'export const raw = import("../client");', RAW],
  ["dynamic template import", "src/app/probe.tsx", "export const raw = import(`@db/client`);", RAW],
  ["require", "db/moods/probe.ts", 'const raw = require("../client");', RAW],
  ["import-equals require", "db/moods/probe.ts", 'import raw = require("../client");', RAW],
  ["relative path from src", "src/probe.ts", 'import { openDatabase } from "../db/client";', RAW],
  ["Expo SQLite namespace", "src/services/probe.ts", 'import * as SQLite from "expo-sqlite";', SQLITE],
  ["Expo SQLite subpath", "db/moods/probe.ts", 'import { openDatabaseAsync } from "expo-sqlite/build/SQLiteDatabase";', SQLITE],
  ["Expo SQLite require in the client", "db/client.ts", 'const SQLite = require("expo-sqlite");', SQLITE],
  ["Expo SQLite dynamic import in the QA proof", "src/qa/encryption/proof.ts", 'export const sqlite = import("expo-sqlite");', SQLITE],
]) {
  test(`lint rejects ${name}`, async () => {
    assert.deepEqual(await boundaryMessages(file, code), [expected]);
  });
}

for (const [name, file, code] of [
  ["readDb by alias", "src/services/probe.ts", 'import { readDb } from "@db/client";'],
  ["renamed readDb with a type import", "db/moods/probe.ts", 'import { readDb as read, type QueryConnection } from "../client";'],
  ["type-only client and SDK imports", "src/hooks/probe.ts", [
    'import type { QueryConnection } from "@db/client";',
    'import { type InitDb } from "@db/client";',
    'import type * as Client from "@db/client";',
    'import type * as SQLite from "expo-sqlite";',
    'export type { QueryConnection as Query } from "@db/client";',
  ].join("\n")],
  ["the write queue opening the connection", "db/writeQueue.ts", 'import { openDatabase } from "./client";'],
  ["the QA proof using the real opener and initializer", "src/qa/encryption/proof.ts", 'import { initializeDatabase, openDatabase } from "@db/client";'],
  ["the native driver importing Expo SQLite", "db/encryption/native.ts", 'import * as SQLite from "expo-sqlite";'],
  ["a different module named client", "src/features/sync/probe.ts", 'import { openDatabase } from "./client";'],
]) {
  test(`lint allows ${name}`, async () => {
    assert.deepEqual(await boundaryMessages(file, code), []);
  });
}

test("types reject the unchanged pre-#59 addEmotion on readDb and allow its writes on WriteTx", () => {
  const errors = typeErrors({
    "db/moods/emotions.ts": readFileSync(path.join(root, "db/moods/emotions.ts"), "utf8"),
    "db/moods/pre59AddEmotion.ts": [
      'import { readDb as getDb } from "../client";',
      'import type { Emotion } from "../types";',
      pre59AddEmotion,
    ].join("\n"),
    "db/moods/pre59AddEmotionQueued.ts": [
      'import type { WriteTx } from "../writeQueue";',
      'import type { Emotion } from "../types";',
      pre59AddEmotion
        .replace("addEmotion(emotion: Emotion)", "addEmotion(db: WriteTx, emotion: Emotion)")
        .replace("  const db = await getDb();\n", ""),
    ].join("\n"),
  });

  assert.deepEqual(errors, {
    "db/moods/emotions.ts": [],
    "db/moods/pre59AddEmotion.ts": [
      { line: 5, code: 2339, message: "Property 'runAsync' does not exist on type 'QueryConnection'." },
    ],
    "db/moods/pre59AddEmotionQueued.ts": [],
  });
});
