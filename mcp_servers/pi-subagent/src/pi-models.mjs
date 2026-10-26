import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { killProcessGroup } from "./process.mjs";

const MAX_OUTPUT_CHARS = 5_000_000;

export function parseModelTable(stdout) {
  const lines = String(stdout)
    .split("\n")
    .map((line) => line.replace(/\r$/, "").trimEnd());
  const headerIndex = lines.findIndex((line) => /^provider\s+model\b/i.test(line.trim()));
  if (headerIndex === -1) return [];

  const models = [];
  for (const line of lines.slice(headerIndex + 1)) {
    const row = line.trim();
    if (row === "") break;
    let parts = row.split(/\s{2,}/);
    if (parts.length < 2) parts = row.split(/\s+/);
    if (parts.length < 2) continue;
    const [provider, model, context, maxOut, thinking, images] = parts;
    if (!provider || !model) continue;
    models.push({
      provider,
      model,
      context: context ?? null,
      max_out: maxOut ?? null,
      thinking: thinking ?? null,
      images: images ?? null,
    });
  }
  return models;
}

export function listModels({
  piBin,
  argsPrefix = [],
  search,
  timeoutMs = 15000,
  killGraceMs = 1000,
  spawnImpl = spawn,
  env = process.env,
  signal,
}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("pi --list-models cancelled"));
      return;
    }
    const args = [...argsPrefix, "--no-extensions", "--no-mcp", "--list-models"];
    if (search) args.push(search);

    let child;
    try {
      child = spawnImpl(piBin, args, {
        env,
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
      });
    } catch (error) {
      reject(new Error(`failed to start pi: ${error.message}`));
      return;
    }

    let stdout = "";
    let stderr = "";
    let timeoutKillTimer = null;
    let abortKillTimer = null;
    let timedOut = false;
    let done = false;
    let onAbort = null;
    const stdoutDecoder = new StringDecoder("utf8");
    const stderrDecoder = new StringDecoder("utf8");

    const finish = (callback, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(timeoutKillTimer);
      if (onAbort) signal?.removeEventListener("abort", onAbort);
      callback(value);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessGroup(child, "SIGTERM");
      timeoutKillTimer = setTimeout(() => killProcessGroup(child, "SIGKILL"), killGraceMs);
    }, timeoutMs);

    if (signal) {
      onAbort = () => {
        if (done) return;
        killProcessGroup(child, "SIGTERM");
        abortKillTimer = setTimeout(() => killProcessGroup(child, "SIGKILL"), killGraceMs);
        abortKillTimer.unref?.();
        finish(reject, new Error("pi --list-models cancelled"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }

    child.stdout.on("error", (error) => {
      killProcessGroup(child, "SIGKILL");
      finish(reject, new Error(`pi --list-models stdout error: ${error.message}`));
    });
    child.stderr.on("error", () => {});
    child.stdout.on("data", (chunk) => {
      stdout += stdoutDecoder.write(chunk);
      if (stdout.length > MAX_OUTPUT_CHARS) {
        killProcessGroup(child, "SIGKILL");
        finish(reject, new Error("pi --list-models produced too much output"));
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${stderrDecoder.write(chunk)}`.slice(-8000);
    });
    child.on("error", (error) => {
      finish(reject, new Error(`failed to start pi: ${error.message}`));
    });
    child.on("close", (code, signalCode) => {
      stdout += stdoutDecoder.end();
      stderr += stderrDecoder.end();
      if (timedOut) {
        finish(reject, new Error(`pi --list-models timed out after ${timeoutMs}ms`));
        return;
      }
      if (code === 0) {
        finish(resolve, { models: parseModelTable(stdout), stderr });
        return;
      }
      const reason = signalCode ? `terminated by signal ${signalCode}` : `exited with code ${code}`;
      finish(reject, new Error(`pi --list-models ${reason}${stderr.trim() ? `: ${stderr.trim()}` : ""}`));
    });
  });
}
