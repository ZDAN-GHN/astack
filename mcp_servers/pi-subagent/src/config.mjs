import os from "node:os";
import path from "node:path";
import { resolveSessionStore } from "./sessions.mjs";

export const LIMITS = Object.freeze({
  defaultTimeoutSeconds: 1800,
  maxTimeoutSeconds: 7200,
  defaultWaitSeconds: 45,
  maxWaitSeconds: 55,
});

function readInt(env, name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

export function loadConfig(env = process.env) {
  const cacheDir = env.PI_SUBAGENT_CACHE_DIR || path.join(os.homedir(), ".cache", "pi-subagent");
  return {
    piBin: env.PI_SUBAGENT_PI_BIN || "pi",
    runsDir: path.join(cacheDir, "runs"),
    maxTextChars: readInt(env, "PI_SUBAGENT_MAX_TEXT_CHARS", 50000, { min: 1000 }),
    maxToolCalls: readInt(env, "PI_SUBAGENT_MAX_TOOL_CALLS", 100, { min: 1 }),
    maxStderrChars: readInt(env, "PI_SUBAGENT_MAX_STDERR_CHARS", 8000, { min: 1000 }),
    ...LIMITS,
    jobTtlMs: 60 * 60 * 1000,
    maxFinishedJobs: 50,
    maxQueuedJobs: 50,
    listModelsTimeoutMs: 15000,
    killGraceMs: 3000,
    shutdownGraceMs: 5000,
    maxTaskChars: 2_000_000,
    maxStdoutLineChars: 10_000_000,
    logWriteTimeoutMs: 30000,
    sessionStore: resolveSessionStore(env),
  };
}
