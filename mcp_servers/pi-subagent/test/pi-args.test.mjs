import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.mjs";
import {
  ValidationError,
  buildPiArgs,
  normalizeDelegateRequest,
  normalizeListModelsRequest,
} from "../src/pi-args.mjs";

const config = loadConfig({});
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pi-args-"));

function sessionConfig({ id = "session-1", sessionCwd = cwd } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-session-store-"));
  const file = path.join(dir, `2026-10-26T12-00-00-000Z_${id}.jsonl`);
  fs.writeFileSync(
    file,
    `${JSON.stringify({
      type: "session",
      version: 3,
      id,
      timestamp: "2026-10-26T12:00:00.000Z",
      cwd: fs.realpathSync(sessionCwd),
    })}\n`,
  );
  return { config: loadConfig({ PI_CODING_AGENT_SESSION_DIR: dir }), file };
}

test("default request is isolated and uses built-in tools", () => {
  const request = normalizeDelegateRequest({ task: "do work", cwd }, config);
  assert.deepEqual(buildPiArgs(request), [
    "--mode",
    "json",
    "--no-extensions",
    "--no-mcp",
    "--tools",
    "read,bash,edit,write",
  ]);
});

test("model, thinking, and tools pass through", () => {
  const request = normalizeDelegateRequest(
    {
      task: "review",
      cwd,
      model: "magpie/opencode-go/beam-free",
      thinking: "high",
      tools: "read, grep, find, ls",
    },
    config,
  );
  const args = buildPiArgs(request);
  assert.deepEqual(args.slice(args.indexOf("--model"), args.indexOf("--model") + 2), [
    "--model",
    "magpie/opencode-go/beam-free",
  ]);
  assert.deepEqual(args.slice(args.indexOf("--thinking"), args.indexOf("--thinking") + 2), [
    "--thinking",
    "high",
  ]);
  assert.deepEqual(args.slice(args.indexOf("--tools"), args.indexOf("--tools") + 2), [
    "--tools",
    "read,grep,find,ls",
  ]);
});

test("default model string means no --model flag", () => {
  const request = normalizeDelegateRequest({ task: "x", cwd, model: "default" }, config);
  assert.equal(request.model, undefined);
  assert.ok(!buildPiArgs(request).includes("--model"));
});

test("session continuation resolves the session file and its cwd", () => {
  const { config: sessionCfg, file } = sessionConfig();
  const resumed = normalizeDelegateRequest({ task: "x", session_id: "session-1" }, sessionCfg);
  assert.equal(resumed.sessionPath, file);
  assert.equal(resumed.cwd, fs.realpathSync(cwd));
  assert.deepEqual(buildPiArgs(resumed).slice(-2), ["--session", file]);

  const ephemeral = normalizeDelegateRequest({ task: "x", cwd, ephemeral: true }, config);
  assert.ok(buildPiArgs(ephemeral).includes("--no-session"));
});

test("session continuation rejects unknown ids and conflicting cwds", () => {
  const { config: sessionCfg } = sessionConfig();
  assert.throws(
    () => normalizeDelegateRequest({ task: "x", session_id: "missing" }, sessionCfg),
    (error) => error instanceof ValidationError && /not found/.test(error.message),
  );

  const other = fs.mkdtempSync(path.join(os.tmpdir(), "pi-args-other-"));
  assert.throws(
    () => normalizeDelegateRequest({ task: "x", cwd: other, session_id: "session-1" }, sessionCfg),
    (error) => error instanceof ValidationError && /belongs to/.test(error.message),
  );
});

test("trust_project maps to approve flags", () => {
  const approved = normalizeDelegateRequest({ task: "x", cwd, trust_project: true }, config);
  assert.ok(buildPiArgs(approved).includes("--approve"));
  const rejected = normalizeDelegateRequest({ task: "x", cwd, trust_project: false }, config);
  assert.ok(buildPiArgs(rejected).includes("--no-approve"));
  const unset = normalizeDelegateRequest({ task: "x", cwd }, config);
  assert.ok(!buildPiArgs(unset).some((arg) => arg === "--approve" || arg === "--no-approve"));
});

test("task never appears on argv", () => {
  const request = normalizeDelegateRequest({ task: "--danger @file", cwd }, config);
  assert.ok(!buildPiArgs(request).includes(request.task));
});

test("unknown input fields are rejected", () => {
  assert.throws(
    () => normalizeDelegateRequest({ task: "x", cwd, concurrent: true }, config),
    (error) => error instanceof ValidationError && /concurrent/.test(error.message),
  );
});

test("blank task is rejected", () => {
  assert.throws(
    () => normalizeDelegateRequest({ task: "  \n", cwd }, config),
    (error) => error instanceof ValidationError && /blank/.test(error.message),
  );
});

test("unknown tool names are rejected", () => {
  assert.throws(
    () => normalizeDelegateRequest({ task: "x", cwd, tools: "read,rm" }, config),
    (error) => error instanceof ValidationError && /unknown tool/.test(error.message),
  );
});

test("option-like model and malformed session ids are rejected", () => {
  assert.throws(
    () => normalizeDelegateRequest({ task: "x", cwd, model: "--help" }, config),
    (error) => error instanceof ValidationError && /start with/.test(error.message),
  );
  assert.throws(
    () => normalizeDelegateRequest({ task: "x", cwd, session_id: "../other/session" }, config),
    (error) => error instanceof ValidationError && /session id/.test(error.message),
  );
  assert.throws(
    () => normalizeDelegateRequest({ task: "x", cwd, session_id: "trailing." }, config),
    (error) => error instanceof ValidationError && /session id/.test(error.message),
  );
});

test("list model search rejects option and file argument prefixes", () => {
  assert.throws(() => normalizeListModelsRequest({ search: "--json" }), ValidationError);
  assert.throws(
    () => normalizeListModelsRequest({ search: "@notes.txt" }),
    (error) => error instanceof ValidationError && /start with/.test(error.message),
  );
});

test("relative and missing cwd are rejected", () => {
  assert.throws(
    () => normalizeDelegateRequest({ task: "x", cwd: "relative/path" }, config),
    (error) => error instanceof ValidationError && /absolute/.test(error.message),
  );
  assert.throws(
    () => normalizeDelegateRequest({ task: "x", cwd: path.join(cwd, "missing") }, config),
    (error) => error instanceof ValidationError && /does not exist/.test(error.message),
  );
});

test("session_id and ephemeral conflict", () => {
  assert.throws(
    () => normalizeDelegateRequest({ task: "x", cwd, session_id: "s1", ephemeral: true }, config),
    (error) => error instanceof ValidationError && /mutually exclusive/.test(error.message),
  );
});

test("timeout and wait bounds come from the schema and config", () => {
  assert.throws(
    () => normalizeDelegateRequest({ task: "x", cwd, timeout_seconds: 0 }, config),
    ValidationError,
  );
  assert.throws(
    () => normalizeDelegateRequest({ task: "x", cwd, wait_seconds: 56 }, config),
    ValidationError,
  );
  const request = normalizeDelegateRequest({ task: "x", cwd }, config);
  assert.equal(request.timeoutSeconds, config.defaultTimeoutSeconds);
  assert.equal(request.waitSeconds, config.defaultWaitSeconds);
});

test("cwd is canonicalized through symlinks", () => {
  const link = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pi-args-link-")), "link");
  fs.symlinkSync(cwd, link);
  const request = normalizeDelegateRequest({ task: "x", cwd: link }, config);
  assert.equal(request.cwd, fs.realpathSync(cwd));
});
