import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import { EventAccumulator, ProtocolError } from "./pi-events.mjs";
import { buildPiArgs } from "./pi-args.mjs";
import { ValidationError } from "./errors.mjs";
import { killProcessGroup } from "./process.mjs";

const TERMINAL = new Set(["completed", "failed", "aborted", "timeout"]);
const DEFAULT_LOG_WRITE_TIMEOUT_MS = 30000;

function logFailure(job) {
  return job.logError ?? job.log?.error?.message ?? null;
}

function spawnFailedEarly(job) {
  return job.spawnError && typeof job.child?.pid !== "number";
}

export function isTerminalStatus(status) {
  return TERMINAL.has(status);
}

export function waitForDrain(stream, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stream.off("drain", onDrain);
      stream.off("error", onError);
      stream.off("close", onClose);
      callback(value);
    };
    const onDrain = () => finish(resolve);
    const onError = (error) => finish(reject, error);
    const onClose = () => finish(reject, new Error("event log stream closed before drain"));
    timer = setTimeout(
      () => finish(reject, new Error(`event log write timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    stream.once("drain", onDrain);
    stream.once("error", onError);
    stream.once("close", onClose);
  });
}

export class EventLog {
  constructor(filePath, { writeTimeoutMs = DEFAULT_LOG_WRITE_TIMEOUT_MS } = {}) {
    this.writeTimeoutMs = writeTimeoutMs;
    this.closed = false;
    this.closePromise = null;
    this.error = null;
    this.stream = createWriteStream(filePath, { flags: "a", mode: 0o600 });
    this.stream.on("error", (error) => {
      this.error = error;
    });
  }

  async write(line) {
    if (this.closed) throw new Error("event log is closed");
    if (this.error) throw this.error;
    const ok = this.stream.write(`${line}\n`);
    if (ok) return;
    await waitForDrain(this.stream, this.writeTimeoutMs);
  }

  close() {
    this.closed = true;
    if (this.closePromise) return this.closePromise;
    this.closePromise = new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const timer = setTimeout(finish, 1000);
      timer.unref?.();
      this.stream.once("close", () => {
        clearTimeout(timer);
        finish();
      });
      this.stream.once("error", () => {
        clearTimeout(timer);
        finish();
      });
      this.stream.end(finish);
    });
    return this.closePromise;
  }
}

export class JobManager {
  constructor({
    config,
    piBin = config.piBin,
    piArgsPrefix = [],
    spawnImpl = spawn,
    createLog,
    logger = (message) => process.stderr.write(`${message}\n`),
    now = Date.now,
  }) {
    this.config = config;
    this.piBin = piBin;
    this.piArgsPrefix = piArgsPrefix;
    this.spawnImpl = spawnImpl;
    this.createLog =
      createLog ??
      ((filePath) => new EventLog(filePath, { writeTimeoutMs: config.logWriteTimeoutMs }));
    this.logger = logger;
    this.now = now;
    this.jobs = new Map();
    this.shuttingDown = false;
  }

  delegate(request) {
    if (this.shuttingDown) throw new Error("server is shutting down");
    const queued = [...this.jobs.values()].filter((job) => job.status === "queued").length;
    if (queued >= this.config.maxQueuedJobs) {
      throw new ValidationError(
        `too many queued jobs (${queued}); wait for running jobs to finish or abort one before delegating`,
      );
    }
    this.prune();
    const id = crypto.randomUUID();
    const job = {
      id,
      request,
      status: "queued",
      createdAt: this.now(),
      startedAt: null,
      finishedAt: null,
      exitCode: null,
      signal: null,
      eventsPath: path.join(this.config.runsDir, `${id}.jsonl`),
      acc: new EventAccumulator({
        cwd: request.cwd,
        maxToolCalls: this.config.maxToolCalls,
        maxTextChars: this.config.maxTextChars,
      }),
      stderr: "",
      child: null,
      log: null,
      timer: null,
      killTimer: null,
      abortRequested: false,
      timedOut: false,
      protocolError: null,
      logError: null,
      spawnError: null,
      stdinError: null,
      stdoutDone: null,
      finalizing: false,
      finalized: false,
      childClosed: false,
      exitObserved: false,
      doneResolved: false,
    };
    job.donePromise = new Promise((resolve) => {
      job.resolveDone = resolve;
    });
    this.jobs.set(id, job);
    this.pump();
    return job;
  }

  get(jobId) {
    this.prune();
    return this.jobs.get(jobId) ?? null;
  }

  result(job) {
    return this.buildResult(job);
  }

  async waitFor(job, seconds, signal) {
    const limit = Math.max(0, Math.min(seconds ?? this.config.defaultWaitSeconds, this.config.maxWaitSeconds));
    if (isTerminalStatus(job.status) || limit === 0 || signal?.aborted) return job;
    await new Promise((resolve) => {
      let settled = false;
      let timer;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", finish);
        resolve();
      };
      timer = setTimeout(finish, limit * 1000);
      job.donePromise.then(finish);
      signal?.addEventListener("abort", finish, { once: true });
    });
    return job;
  }

  abort(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    if (isTerminalStatus(job.status)) return job;
    if (job.status === "running" && this.hasExited(job)) return job;
    job.abortRequested = true;
    if (job.status === "queued") {
      job.status = "aborted";
      job.finishedAt = this.now();
      this.resolveDone(job);
      this.prune();
    } else if (job.status === "running") {
      this.terminate(job);
    }
    return job;
  }

  hasExited(job) {
    return (
      job.exitObserved ||
      (job.child !== null && (job.child.exitCode !== null || job.child.signalCode !== null))
    );
  }

  async shutdown() {
    this.shuttingDown = true;
    const live = [...this.jobs.values()].filter((job) => !isTerminalStatus(job.status));
    for (const job of live) this.abort(job.id);
    if (live.length > 0) {
      let graceTimer;
      await Promise.race([
        Promise.allSettled(live.map((job) => job.donePromise)),
        new Promise((resolve) => {
          graceTimer = setTimeout(resolve, this.config.shutdownGraceMs);
        }),
      ]);
      clearTimeout(graceTimer);
    }
    for (const job of live) {
      if (!job.childClosed && job.child) killProcessGroup(job.child, "SIGKILL");
    }
  }

  pump() {
    if (this.shuttingDown) return;
    for (const job of this.jobs.values()) {
      if (job.status !== "queued") continue;
      if (this.hasConflict(job)) continue;
      this.start(job);
    }
  }

  hasConflict(job) {
    const sessionKey = job.request.sessionPath ?? job.request.sessionId;
    for (const other of this.jobs.values()) {
      if (other === job || other.status !== "running") continue;
      if (other.request.cwd === job.request.cwd) return true;
      const otherSessionKey = other.request.sessionPath ?? other.request.sessionId;
      if (sessionKey && otherSessionKey === sessionKey) return true;
    }
    return false;
  }

  start(job) {
    job.status = "running";
    job.startedAt = this.now();

    try {
      fs.mkdirSync(this.config.runsDir, { recursive: true, mode: 0o700 });
      try {
        fs.chmodSync(this.config.runsDir, 0o700);
      } catch {}
      job.log = this.createLog(job.eventsPath);
      try {
        fs.chmodSync(job.eventsPath, 0o600);
      } catch {}
    } catch (error) {
      job.logError = `cannot open event log: ${error.message}`;
      void this.finalize(job, null, null);
      return;
    }

    const args = [...this.piArgsPrefix, ...buildPiArgs(job.request)];
    try {
      job.child = this.spawnImpl(this.piBin, args, {
        cwd: job.request.cwd,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
        detached: process.platform !== "win32",
      });
    } catch (error) {
      job.spawnError = error;
      void this.finalize(job, null, null);
      return;
    }

    const child = job.child;
    const stderrDecoder = new StringDecoder("utf8");
    child.on("error", (error) => {
      job.spawnError = error;
      if (spawnFailedEarly(job)) void this.finalizeAfterStdout(job, null, null);
      else this.terminate(job);
    });
    child.on("exit", () => {
      job.exitObserved = true;
      clearTimeout(job.timer);
      job.timer = null;
    });
    child.stdin.on("error", (error) => {
      job.stdinError = error;
    });
    child.stdout.on("error", (error) => {
      if (job.finalized || job.finalizing) return;
      if (job.abortRequested || job.timedOut || job.spawnError || job.protocolError || logFailure(job)) {
        return;
      }
      job.protocolError = `stdout stream error: ${error.message}`;
      this.terminate(job);
    });
    child.stderr.on("error", () => {});
    child.stderr.on("data", (chunk) => {
      job.stderr = `${job.stderr}${stderrDecoder.write(chunk)}`.slice(-this.config.maxStderrChars);
    });
    child.on("close", (code, signal) => {
      job.childClosed = true;
      void this.finalizeAfterStdout(job, code, signal);
    });

    job.timer = setTimeout(() => {
      if (this.hasExited(job)) return;
      job.timedOut = true;
      this.terminate(job);
    }, job.request.timeoutSeconds * 1000);
    job.timer.unref?.();

    job.stdoutDone = this.consumeStdout(job, child);

    try {
      child.stdin.end(job.request.task);
    } catch (error) {
      job.stdinError = error;
    }
  }

  async finalizeAfterStdout(job, code, signal) {
    if (job.stdoutDone) {
      try {
        await job.stdoutDone;
      } catch {}
    }
    await this.finalize(job, code, signal);
  }

  terminate(job) {
    const child = job.child;
    if (!child || job.childClosed) return;
    killProcessGroup(child, "SIGTERM");
    if (!job.killTimer) {
      job.killTimer = setTimeout(() => killProcessGroup(child, "SIGKILL"), this.config.killGraceMs);
      job.killTimer.unref?.();
    }
  }

  async consumeStdout(job, child) {
    const decoder = new StringDecoder("utf8");
    let buffer = "";
    try {
      for await (const chunk of child.stdout) {
        buffer += decoder.write(chunk);
        if (buffer.length > this.config.maxStdoutLineChars && !buffer.includes("\n")) {
          throw new ProtocolError(`stdout line exceeds ${this.config.maxStdoutLineChars} characters`);
        }
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          await this.handleLine(job, line);
        }
      }
      buffer += decoder.end();
      if (buffer.length > 0) {
        let line = buffer;
        if (line.endsWith("\r")) line = line.slice(0, -1);
        await this.handleLine(job, line);
      }
    } catch (error) {
      if (job.finalized || job.finalizing) return;
      if (spawnFailedEarly(job)) return;
      if (error instanceof ProtocolError) job.protocolError = error.message;
      else job.logError = error.message;
      this.terminate(job);
    }
  }

  async handleLine(job, line) {
    if (job.log) {
      try {
        await job.log.write(line);
      } catch (error) {
        job.logError = error.message;
        throw error;
      }
    }
    job.acc.handle(line);
  }

  async finalize(job, code, signal) {
    if (job.finalizing || job.finalized) return;
    job.finalizing = true;
    job.childClosed = true;
    clearTimeout(job.timer);
    clearTimeout(job.killTimer);

    job.exitCode = code;
    job.signal = signal;
    job.finishedAt = this.now();

    if (job.log) {
      await job.log.close();
      if (job.log.error && !job.logError) job.logError = job.log.error.message;
    }

    job.status = this.deriveStatus(job, code, signal);
    job.finalizing = false;
    job.finalized = true;
    this.resolveDone(job);
    this.prune();
    this.pump();
  }

  resolveDone(job) {
    if (job.doneResolved) return;
    job.doneResolved = true;
    job.resolveDone();
  }

  deriveStatus(job, code, signal) {
    if (job.abortRequested) return "aborted";
    if (job.timedOut) return "timeout";
    if (logFailure(job) || job.protocolError) return "failed";
    if (spawnFailedEarly(job)) return "failed";

    const acc = job.acc;
    if (code !== 0) return "failed";
    if (acc.messages.length === 0) return "failed";
    if (!acc.settled) return "failed";
    if (acc.settledAborted) return "failed";
    const stopReason = acc.finalStopReason();
    if (stopReason === "error" || stopReason === "aborted") return "failed";
    return "completed";
  }

  failureMessage(job, code, signal) {
    if (job.protocolError) return `pi protocol error: ${job.protocolError}`;
    const logError = logFailure(job);
    if (logError) return `event log write failed: ${logError}`;
    if (job.spawnError) return `failed to start pi: ${job.spawnError.message}`;

    const stderr = job.stderr.trim();
    const stderrSuffix = stderr ? ` ${stderr.slice(0, 500)}` : "";
    if (signal) return `pi was terminated by signal ${signal}.${stderrSuffix}`;
    if (code !== 0) return `pi exited with code ${code}.${stderrSuffix}`;

    const acc = job.acc;
    if (acc.messages.length === 0) return `pi produced no assistant message.${stderrSuffix}`;
    if (!acc.settled) return `pi exited before agent_settled.${stderrSuffix}`;
    if (acc.settledAborted) return "pi reported an aborted run";
    const stopReason = acc.finalStopReason();
    if (stopReason === "error" || stopReason === "aborted") {
      return acc.finalErrorMessage() ?? `pi stopped with reason "${stopReason}"`;
    }
    return "pi run failed";
  }

  buildResult(job) {
    const summary = job.acc.summarize();
    const active = job.status === "queued" || job.status === "running";
    const duration = job.startedAt === null ? 0 : (job.finishedAt ?? this.now()) - job.startedAt;
    const result = {
      job_id: job.id,
      status: job.status,
      text: "",
      text_truncated: false,
      model: null,
      session_id: summary.session_id,
      stop_reason: null,
      usage: null,
      tool_calls: [],
      tool_calls_truncated: false,
      changed_files: [],
      changed_files_truncated: false,
      duration_ms: Math.max(0, duration),
      error: null,
      stderr_tail: job.stderr.trim() ? job.stderr.trim() : null,
      events_path: job.startedAt === null ? null : job.eventsPath,
      warnings: [],
    };

    if (active) {
      result.hint = "Job is still active. Call pi_job_result with this job_id and wait_seconds to wait for completion.";
      return result;
    }

    result.text = summary.text;
    result.text_truncated = summary.text_truncated;
    result.model = summary.model;
    result.stop_reason = summary.stop_reason;
    result.usage = summary.usage;
    result.tool_calls = summary.tool_calls;
    result.tool_calls_truncated = summary.tool_calls_truncated;
    result.changed_files = summary.changed_files;
    result.changed_files_truncated = summary.changed_files_truncated;

    if (job.status === "failed") result.error = this.failureMessage(job, job.exitCode, job.signal);
    if (job.status === "timeout") result.error = `timeout after ${job.request.timeoutSeconds}s`;
    if (job.status === "aborted") result.error = "aborted by caller";
    if (job.status === "completed" && summary.stop_reason === "length") {
      result.warnings.push("Model output stopped at its length limit (stop reason: length). The text is partial.");
    }
    if (summary.changed_files_truncated) {
      result.warnings.push("changed_files is capped at 200 entries; use git status for the full list.");
    }
    if (job.stdinError) {
      result.warnings.push(`stdin: ${job.stdinError.message}`);
    }
    if (job.status === "completed" && job.stderr.trim()) {
      result.warnings.push("pi wrote to stderr during this run; see stderr_tail.");
    }
    return result;
  }

  prune() {
    const now = this.now();
    for (const [id, job] of this.jobs) {
      if (isTerminalStatus(job.status) && job.finishedAt !== null && now - job.finishedAt > this.config.jobTtlMs) {
        this.jobs.delete(id);
      }
    }
    const finished = [...this.jobs.values()]
      .filter((job) => isTerminalStatus(job.status))
      .sort((a, b) => a.finishedAt - b.finishedAt);
    while (finished.length > this.config.maxFinishedJobs) {
      const oldest = finished.shift();
      this.jobs.delete(oldest.id);
    }
  }
}
