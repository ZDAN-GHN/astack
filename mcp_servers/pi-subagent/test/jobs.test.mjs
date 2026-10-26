import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/config.mjs";
import { EventLog, JobManager, waitForDrain } from "../src/jobs.mjs";
import { normalizeDelegateRequest } from "../src/pi-args.mjs";

const fixture = fileURLToPath(new URL("./fixtures/fake-pi.mjs", import.meta.url));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setup(t, { piBin = process.execPath, piArgsPrefix = [fixture], env = {}, createLog } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-jobs-"));
  const cwd = fs.mkdtempSync(path.join(root, "cwd-"));
  const sessionDir = path.join(root, "sessions");
  fs.mkdirSync(sessionDir, { recursive: true });
  const config = loadConfig({
    PI_SUBAGENT_CACHE_DIR: path.join(root, "cache"),
    PI_CODING_AGENT_SESSION_DIR: sessionDir,
    ...env,
  });
  const manager = new JobManager({ config, piBin, piArgsPrefix, logger: () => {}, createLog });
  t.after(async () => {
    await manager.shutdown();
  });
  return { root, cwd, sessionDir, config, manager };
}

function writeSessionFile(sessionDir, cwd, id) {
  const file = path.join(sessionDir, `2026-10-26T12-00-00-000Z_${id}.jsonl`);
  fs.writeFileSync(
    file,
    `${JSON.stringify({
      type: "session",
      version: 3,
      id,
      timestamp: "2026-10-26T12:00:00.000Z",
      cwd: fs.realpathSync(cwd),
    })}\n`,
  );
  return file;
}

function slowLogFactory(delayMs = 400) {
  return (filePath) => {
    const log = new EventLog(filePath);
    const write = log.write.bind(log);
    log.write = async (line) => {
      await sleep(delayMs);
      await write(line);
    };
    return log;
  };
}

function start(manager, config, cwd, task, overrides = {}) {
  const request = normalizeDelegateRequest({ task, cwd, wait_seconds: 10, ...overrides }, config);
  return manager.delegate(request);
}

async function run(manager, config, cwd, task, overrides = {}) {
  const job = start(manager, config, cwd, task, overrides);
  await manager.waitFor(job, 10);
  return manager.result(job);
}

test("completed run returns text, model, usage, session and log path", async (t) => {
  const { cwd, config, manager } = setup(t);
  const result = await run(manager, config, cwd, "[fake:ok]", {
    model: "magpie/opencode-go/beam-free",
  });
  assert.equal(result.status, "completed");
  assert.equal(result.text, "FAKE_OK");
  assert.deepEqual(result.model, { provider: "fake", id: "magpie/opencode-go/beam-free" });
  assert.equal(result.session_id, "fake-session-1");
  assert.equal(result.stop_reason, "stop");
  assert.deepEqual(result.usage, {
    input: 10,
    output: 5,
    cache_read: 1,
    cache_write: 0,
    total: 16,
    cost_total: 0.001,
  });
  assert.equal(result.error, null);
  assert.ok(fs.existsSync(result.events_path));
  assert.ok(fs.statSync(result.events_path).size > 0);
});

test("nonzero exit is failed with stderr", async (t) => {
  const { cwd, config, manager } = setup(t);
  const result = await run(manager, config, cwd, "[fake:fail]");
  assert.equal(result.status, "failed");
  assert.match(result.error, /exited with code 1/);
  assert.match(result.stderr_tail, /fake failure/);
});

test("execution timeout terminates the process group", async (t) => {
  const { cwd, config, manager } = setup(t);
  const startedAt = Date.now();
  const result = await run(manager, config, cwd, "[fake:hang]", { timeout_seconds: 1 });
  assert.equal(result.status, "timeout");
  assert.match(result.error, /timeout after 1s/);
  assert.ok(Date.now() - startedAt >= 900, "timeout should not fire before the budget");
});

test("abort stops a running job and is idempotent", async (t) => {
  const { cwd, config, manager } = setup(t);
  const job = start(manager, config, cwd, "[fake:hang]");
  await sleep(150);
  assert.equal(job.status, "running");
  const aborted = manager.abort(job.id);
  assert.equal(aborted, job);
  await manager.waitFor(job, 10);
  const result = manager.result(job);
  assert.equal(result.status, "aborted");
  assert.equal(result.error, "aborted by caller");
  manager.abort(job.id);
  assert.equal(manager.result(job).status, "aborted");
});

test("queued jobs can be aborted before they start", async (t) => {
  const { cwd, config, manager } = setup(t);
  const first = start(manager, config, cwd, "[fake:hang]");
  await sleep(100);
  const second = start(manager, config, cwd, "[fake:ok]");
  assert.equal(second.status, "queued");

  manager.abort(second.id);
  const secondResult = manager.result(second);
  assert.equal(secondResult.status, "aborted");
  assert.equal(secondResult.events_path, null);
  assert.equal(first.status, "running");

  manager.abort(first.id);
  await manager.waitFor(first, 10);
  assert.equal(manager.result(first).status, "aborted");
});

test("jobs in the same cwd run in order, one at a time", async (t) => {
  const { cwd, config, manager } = setup(t);
  const first = start(manager, config, cwd, "[fake:slow]");
  const second = start(manager, config, cwd, "[fake:ok]");
  assert.equal(second.status, "queued");

  await manager.waitFor(first, 10);
  await manager.waitFor(second, 10);
  assert.equal(manager.result(first).status, "completed");
  assert.equal(manager.result(second).status, "completed");
  assert.ok(second.startedAt >= first.finishedAt, "second job should start after the first finished");
});

test("a session continuation runs in the session's cwd when cwd is omitted", async (t) => {
  const { cwd, sessionDir, config, manager } = setup(t);
  const sessionFile = writeSessionFile(sessionDir, cwd, "session-a");
  const request = normalizeDelegateRequest({ task: "[fake:args]", session_id: "session-a" }, config);
  assert.equal(request.cwd, fs.realpathSync(cwd));

  const job = manager.delegate(request);
  await manager.waitFor(job, 10);
  const result = manager.result(job);
  assert.equal(result.status, "completed");
  const args = JSON.parse(result.text);
  assert.equal(args[args.indexOf("--session") + 1], sessionFile);
  assert.equal(result.session_id, "session-a");
});

test("the same session runs one task at a time", async (t) => {
  const { cwd, sessionDir, config, manager } = setup(t);
  writeSessionFile(sessionDir, cwd, "shared-session");
  const first = start(manager, config, cwd, "[fake:hang]", { session_id: "shared-session" });
  await sleep(100);
  const second = start(manager, config, cwd, "[fake:ok]", { session_id: "shared-session" });
  assert.equal(second.status, "queued");

  manager.abort(first.id);
  await manager.waitFor(first, 10);
  await manager.waitFor(second, 10);
  assert.equal(manager.result(second).status, "completed");
});

test("malformed stdout fails the job and keeps the raw line in the log", async (t) => {
  const { cwd, config, manager } = setup(t);
  const result = await run(manager, config, cwd, "[fake:badjson]");
  assert.equal(result.status, "failed");
  assert.match(result.error, /protocol error/);
  assert.match(fs.readFileSync(result.events_path, "utf8"), /this is not json/);
});

test("a run without agent_settled is not completed", async (t) => {
  const { cwd, config, manager } = setup(t);
  const result = await run(manager, config, cwd, "[fake:nosettle]");
  assert.equal(result.status, "failed");
  assert.match(result.error, /agent_settled/);
});

test("length stop reason is completed with a partial-output warning", async (t) => {
  const { cwd, config, manager } = setup(t);
  const result = await run(manager, config, cwd, "[fake:length]");
  assert.equal(result.status, "completed");
  assert.equal(result.stop_reason, "length");
  assert.ok(result.warnings.some((warning) => /length/.test(warning)));
});

test("successful writes appear in changed_files, failed writes do not", async (t) => {
  const { cwd, config, manager } = setup(t);
  const ok = await run(manager, config, cwd, "[fake:tool]");
  assert.deepEqual(ok.changed_files, [path.join(cwd, "proof.txt")]);
  assert.deepEqual(ok.tool_calls, [{ name: "write", target: "proof.txt", ok: true, duration_ms: 4 }]);

  const failed = await run(manager, config, cwd, "[fake:toolfail]");
  assert.deepEqual(failed.changed_files, []);
  assert.equal(failed.tool_calls[0].ok, false);
});

test("ephemeral runs pass --no-session and have no session id", async (t) => {
  const { cwd, config, manager } = setup(t);
  const result = await run(manager, config, cwd, "[fake:args]", { ephemeral: true });
  const args = JSON.parse(result.text);
  assert.ok(args.includes("--no-session"));
  assert.equal(result.session_id, null);
});

test("wait_seconds 0 returns a running job without aborting it", async (t) => {
  const { cwd, config, manager } = setup(t);
  const job = start(manager, config, cwd, "[fake:hang]", { wait_seconds: 0 });
  await manager.waitFor(job, 0);
  const result = manager.result(job);
  assert.equal(result.status, "running");
  assert.match(result.hint, /pi_job_result/);

  manager.abort(job.id);
  await manager.waitFor(job, 10);
  assert.equal(manager.result(job).status, "aborted");
});

test("UTF-8 characters split across stdout chunks are decoded correctly", async (t) => {
  const { cwd, config, manager } = setup(t);
  const result = await run(manager, config, cwd, "[fake:unicode]");
  assert.equal(result.status, "completed");
  assert.equal(result.text, "中文-😀-ok");
});

test("a missing pi binary fails with a clear error", async (t) => {
  const { cwd, config, manager } = setup(t, { piBin: "/nonexistent/pi-binary-xyz", piArgsPrefix: [] });
  const result = await run(manager, config, cwd, "anything");
  assert.equal(result.status, "failed");
  assert.match(result.error, /failed to start pi/);
});

test("timeout kills descendants in the pi process group", async (t) => {
  const { root, cwd, config, manager } = setup(t);
  const pidFile = path.join(root, "grandchild.pid");
  process.env.FAKE_PI_CHILD_PID_FILE = pidFile;
  try {
    const result = await run(manager, config, cwd, "[fake:tree]", { timeout_seconds: 1 });
    assert.equal(result.status, "timeout");
    const pid = Number(fs.readFileSync(pidFile, "utf8"));
    assert.ok(Number.isInteger(pid) && pid > 0);
    await waitForProcessGone(pid);
  } finally {
    delete process.env.FAKE_PI_CHILD_PID_FILE;
  }
});

test("finished jobs are pruned to the configured maximum", async (t) => {
  const { cwd, config, manager } = setup(t);
  manager.config.maxFinishedJobs = 1;
  await run(manager, config, cwd, "[fake:ok]");
  await run(manager, config, cwd, "[fake:ok]");
  assert.equal([...manager.jobs.values()].filter((job) => job.finishedAt !== null).length, 1);
});

test("event log directory and files are private", async (t) => {
  const { cwd, config, manager } = setup(t);
  const result = await run(manager, config, cwd, "[fake:ok]");
  const dirMode = fs.statSync(config.runsDir).mode & 0o777;
  const fileMode = fs.statSync(result.events_path).mode & 0o777;
  assert.equal(dirMode, 0o700);
  assert.equal(fileMode, 0o600);
});

test("a timeout does not override a process that already exited", async (t) => {
  const { cwd, config, manager } = setup(t, { createLog: slowLogFactory(400) });
  const result = await run(manager, config, cwd, "[fake:slow]", { timeout_seconds: 1 });
  assert.equal(result.status, "completed");
  assert.equal(result.error, null);
  assert.equal(result.text, "FAKE_SLOW");
});

test("aborting after the process exits leaves the completed result intact", async (t) => {
  const { cwd, config, manager } = setup(t, { createLog: slowLogFactory(400) });
  const job = start(manager, config, cwd, "[fake:slow]", { timeout_seconds: 10 });
  await sleep(600);
  assert.equal(job.status, "running");
  manager.abort(job.id);
  await manager.waitFor(job, 10);
  const result = manager.result(job);
  assert.equal(result.status, "completed");
  assert.equal(result.error, null);
});

test("delegation is rejected after shutdown starts", async (t) => {
  const { cwd, config, manager } = setup(t);
  await manager.shutdown();
  const request = normalizeDelegateRequest({ task: "x", cwd }, config);
  assert.throws(() => manager.delegate(request), /shutting down/);
});

test("shutdown aborts live jobs and kills their process group", async (t) => {
  const { root, cwd, config, manager } = setup(t);
  const pidFile = path.join(root, "shutdown-child.pid");
  process.env.FAKE_PI_CHILD_PID_FILE = pidFile;
  try {
    const job = start(manager, config, cwd, "[fake:tree]", { timeout_seconds: 60 });
    const pid = await waitForPidFile(pidFile);
    await manager.shutdown();
    assert.equal(manager.result(job).status, "aborted");
    await waitForProcessGone(pid);
  } finally {
    delete process.env.FAKE_PI_CHILD_PID_FILE;
  }
});

test("the queued job limit rejects new delegations", async (t) => {
  const { cwd, config, manager } = setup(t);
  manager.config.maxQueuedJobs = 1;
  const first = start(manager, config, cwd, "[fake:hang]");
  await sleep(100);
  const second = start(manager, config, cwd, "[fake:ok]");
  assert.equal(second.status, "queued");
  assert.throws(() => start(manager, config, cwd, "[fake:ok]"), /too many queued jobs/);

  manager.abort(first.id);
  await manager.waitFor(first, 10);
  await manager.waitFor(second, 10);
});

test("an event log write failure fails the job", async (t) => {
  const { cwd, config, manager } = setup(t, {
    createLog: (filePath) => {
      const log = new EventLog(filePath);
      log.write = async () => {
        throw new Error("disk full");
      };
      return log;
    },
  });
  const result = await run(manager, config, cwd, "[fake:ok]");
  assert.equal(result.status, "failed");
  assert.match(result.error, /event log write failed: disk full/);
});

test("a failed job releases the queue for the next job in its cwd", async (t) => {
  const { cwd, config, manager } = setup(t);
  const first = start(manager, config, cwd, "[fake:fail]");
  const second = start(manager, config, cwd, "[fake:ok]");
  await manager.waitFor(first, 10);
  await manager.waitFor(second, 10);
  assert.equal(manager.result(first).status, "failed");
  assert.equal(manager.result(second).status, "completed");
});

test("a stalled event log drain times out", async () => {
  const stream = new EventEmitter();
  await assert.rejects(waitForDrain(stream, 20), /timed out/);
});

async function waitForPidFile(file, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const pid = Number(fs.readFileSync(file, "utf8"));
      if (Number.isInteger(pid) && pid > 0) return pid;
    } catch {}
    await sleep(50);
  }
  assert.fail(`pid file ${file} was not written`);
}

async function waitForProcessGone(pid, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") return;
      throw error;
    }
    await sleep(50);
  }
  assert.fail(`process ${pid} is still alive after ${timeoutMs}ms`);
}
