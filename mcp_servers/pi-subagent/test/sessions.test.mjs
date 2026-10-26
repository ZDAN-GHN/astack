import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ValidationError } from "../src/errors.mjs";
import { resolveSession, resolveSessionStore } from "../src/sessions.mjs";

function writeSession(dir, { id, cwd, timestamp = "2026-10-26T12-00-00-000Z" }) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${timestamp}_${id}.jsonl`);
  fs.writeFileSync(
    file,
    `${JSON.stringify({ type: "session", version: 3, id, timestamp: "2026-10-26T12:00:00.000Z", cwd })}\n`,
  );
  return file;
}

function tempDir(prefix = "pi-sessions-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("resolves an exact session from a flat session directory", () => {
  const dir = tempDir();
  const cwd = tempDir("pi-session-cwd-");
  const file = writeSession(dir, { id: "session-1", cwd });
  const store = { kind: "flat", dir };

  const resolved = resolveSession({ sessionId: "session-1", store });
  assert.equal(resolved.path, file);
  assert.equal(resolved.cwd, fs.realpathSync(cwd));
  assert.equal(resolved.id, "session-1");
});

test("uses the session's own cwd and rejects a conflicting explicit cwd", () => {
  const dir = tempDir();
  const cwd = tempDir("pi-session-cwd-");
  const other = tempDir("pi-session-other-");
  writeSession(dir, { id: "session-2", cwd });
  const store = { kind: "flat", dir };

  assert.throws(
    () => resolveSession({ sessionId: "session-2", requestedCwd: other, store }),
    (error) => error instanceof ValidationError && /belongs to/.test(error.message) && error.message.includes(cwd),
  );
  const matched = resolveSession({ sessionId: "session-2", requestedCwd: fs.realpathSync(cwd), store });
  assert.equal(matched.cwd, fs.realpathSync(cwd));
});

test("unknown session ids fail instead of falling back to pi's prefix lookup", () => {
  const dir = tempDir();
  const store = { kind: "flat", dir };
  writeSession(dir, { id: "session-abcdef", cwd: tempDir("pi-session-cwd-") });

  assert.throws(
    () => resolveSession({ sessionId: "session", store }),
    (error) => error instanceof ValidationError && /not found/.test(error.message),
  );
});

test("the default store finds sessions under the encoded project directory", () => {
  const root = tempDir();
  const cwd = fs.realpathSync(tempDir("pi-session-cwd-"));
  const encoded = `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
  const dir = path.join(root, encoded);
  const file = writeSession(dir, { id: "session-3", cwd });

  const resolved = resolveSession({ sessionId: "session-3", store: { kind: "default", root } });
  assert.equal(resolved.path, file);
  assert.equal(resolved.cwd, cwd);
});

test("ambiguous ids across projects require cwd", () => {
  const root = tempDir();
  const cwdA = fs.realpathSync(tempDir("pi-session-a-"));
  const cwdB = fs.realpathSync(tempDir("pi-session-b-"));
  const dirFor = (cwd) => path.join(root, `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`);
  writeSession(dirFor(cwdA), { id: "session-4", cwd: cwdA });
  writeSession(dirFor(cwdB), { id: "session-4", cwd: cwdB });
  const store = { kind: "default", root };

  assert.throws(
    () => resolveSession({ sessionId: "session-4", store }),
    (error) => error instanceof ValidationError && /multiple projects/.test(error.message),
  );
  const chosen = resolveSession({ sessionId: "session-4", requestedCwd: cwdB, store });
  assert.equal(chosen.cwd, cwdB);
});

test("a missing working directory is reported, not silently reused", () => {
  const dir = tempDir();
  const cwd = tempDir("pi-session-cwd-");
  writeSession(dir, { id: "session-5", cwd });
  fs.rmdirSync(cwd);

  assert.throws(
    () => resolveSession({ sessionId: "session-5", store: { kind: "flat", dir } }),
    (error) => error instanceof ValidationError && /working directory/.test(error.message),
  );
});

test("a file whose header id differs is ignored", () => {
  const dir = tempDir();
  const cwd = tempDir("pi-session-cwd-");
  writeSession(dir, { id: "other-id", cwd });

  assert.throws(
    () => resolveSession({ sessionId: "session-6", store: { kind: "flat", dir } }),
    ValidationError,
  );
});

test("store resolution honors the env dir, settings sessionDir, and default root", () => {
  const envDir = tempDir("pi-session-env-");
  assert.deepEqual(resolveSessionStore({ PI_CODING_AGENT_SESSION_DIR: envDir }), {
    kind: "flat",
    dir: envDir,
  });

  const agentDir = tempDir("pi-agent-");
  const settingsDir = tempDir("pi-session-settings-");
  fs.writeFileSync(path.join(agentDir, "settings.json"), JSON.stringify({ sessionDir: settingsDir }));
  assert.deepEqual(resolveSessionStore({ PI_CODING_AGENT_DIR: agentDir }), {
    kind: "flat",
    dir: settingsDir,
  });

  assert.deepEqual(resolveSessionStore({ PI_CODING_AGENT_DIR: agentDir, PI_CODING_AGENT_SESSION_DIR: envDir }), {
    kind: "flat",
    dir: envDir,
  });

  const bare = tempDir("pi-agent-bare-");
  assert.deepEqual(resolveSessionStore({ PI_CODING_AGENT_DIR: bare }), {
    kind: "default",
    root: path.join(bare, "sessions"),
  });
});
