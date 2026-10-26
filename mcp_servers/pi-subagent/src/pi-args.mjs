import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { LIMITS } from "./config.mjs";
import { ValidationError } from "./errors.mjs";
import { resolveSession } from "./sessions.mjs";

export { ValidationError };

export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
export const BUILTIN_TOOLS = ["read", "bash", "edit", "write", "grep", "find", "ls"];
export const DEFAULT_TOOLS = "read,bash,edit,write";

const SESSION_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,198}[A-Za-z0-9])?$/;
const OPTION_LIKE = /^-/;
const BLANK = /^\s*$/;


export const delegateInputSchema = z
  .strictObject({
    task: z.string(),
    model: z.string().optional(),
    thinking: z.enum(THINKING_LEVELS).optional(),
    cwd: z.string().optional(),
    tools: z.string().optional(),
    session_id: z.string().optional(),
    ephemeral: z.boolean().optional(),
    trust_project: z.boolean().optional(),
    timeout_seconds: z.number().int().min(1).max(LIMITS.maxTimeoutSeconds).optional(),
    wait_seconds: z.number().int().min(0).max(LIMITS.maxWaitSeconds).optional(),
  });

export const jobResultInputSchema = z.strictObject({
  job_id: z.string(),
  wait_seconds: z.number().int().min(0).max(LIMITS.maxWaitSeconds).optional(),
});

export const jobAbortInputSchema = z.strictObject({
  job_id: z.string(),
});

export const listModelsInputSchema = z.strictObject({
  search: z.string().optional(),
});

function parseWith(schema, raw) {
  const parsed = schema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data;
  const detail = parsed.error.issues
    .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
    .join("; ");
  throw new ValidationError(detail);
}

function normalizeTools(raw) {
  const names = String(raw)
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (names.length === 0) {
    throw new ValidationError(`tools must name at least one of: ${BUILTIN_TOOLS.join(", ")}`);
  }
  const unknown = names.filter((name) => !BUILTIN_TOOLS.includes(name));
  if (unknown.length > 0) {
    throw new ValidationError(
      `unknown tool(s): ${unknown.join(", ")}. Allowed built-in tools: ${BUILTIN_TOOLS.join(", ")}`,
    );
  }
  return [...new Set(names)].join(",");
}

function resolveCwd(raw) {
  if (!path.isAbsolute(raw)) {
    throw new ValidationError("cwd must be an absolute path");
  }
  let resolved;
  try {
    resolved = fs.realpathSync(raw);
  } catch (error) {
    throw new ValidationError(`cwd does not exist or is not accessible: ${raw} (${error.code || error.message})`);
  }
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch (error) {
    throw new ValidationError(`cannot stat cwd ${raw}: ${error.message}`);
  }
  if (!stat.isDirectory()) {
    throw new ValidationError(`cwd is not a directory: ${raw}`);
  }
  return resolved;
}

export function normalizeDelegateRequest(raw, config) {
  const input = parseWith(delegateInputSchema, raw);
  const task = input.task;
  if (BLANK.test(task)) {
    throw new ValidationError("task must not be blank");
  }
  if (task.length > config.maxTaskChars) {
    throw new ValidationError(`task exceeds ${config.maxTaskChars} characters`);
  }

  let model;
  if (input.model !== undefined) {
    model = input.model.trim();
    if (model === "default") {
      model = undefined;
    } else if (model === "") {
      throw new ValidationError("model must not be blank");
    } else if (OPTION_LIKE.test(model)) {
      throw new ValidationError("model must not start with '-'");
    }
  }

  let sessionId;
  if (input.session_id !== undefined) {
    sessionId = input.session_id.trim();
    if (!SESSION_ID_PATTERN.test(sessionId)) {
      throw new ValidationError(
        "session_id must be a session id (letters, digits, dot, underscore, dash; start and end alphanumeric), not a file path",
      );
    }
  }

  const ephemeral = input.ephemeral === true;
  if (ephemeral && sessionId !== undefined) {
    throw new ValidationError("session_id and ephemeral are mutually exclusive");
  }

  const explicitCwd = input.cwd === undefined ? undefined : resolveCwd(input.cwd);
  let cwd = explicitCwd ?? resolveCwd(process.cwd());
  let sessionPath;
  if (sessionId !== undefined) {
    const session = resolveSession({
      sessionId,
      requestedCwd: explicitCwd,
      store: config.sessionStore,
    });
    sessionId = session.id;
    sessionPath = session.path;
    cwd = session.cwd;
  }
  const tools = normalizeTools(input.tools ?? DEFAULT_TOOLS);
  const timeoutSeconds = input.timeout_seconds ?? config.defaultTimeoutSeconds;

  return {
    task,
    model,
    thinking: input.thinking,
    cwd,
    tools,
    sessionId,
    sessionPath,
    ephemeral,
    trustProject: input.trust_project,
    timeoutSeconds,
    waitSeconds: input.wait_seconds ?? config.defaultWaitSeconds,
  };
}

export function buildPiArgs(request) {
  const args = [
    "--mode",
    "json",
    "--no-extensions",
    "--no-mcp",
    "--tools",
    request.tools,
  ];
  if (request.model) args.push("--model", request.model);
  if (request.thinking) args.push("--thinking", request.thinking);
  if (request.sessionId) {
    if (!request.sessionPath) throw new Error("sessionPath is required when sessionId is set");
    args.push("--session", request.sessionPath);
  } else if (request.ephemeral) {
    args.push("--no-session");
  }
  if (request.trustProject === true) args.push("--approve");
  if (request.trustProject === false) args.push("--no-approve");
  return args;
}

export function normalizeJobResultRequest(raw) {
  const input = parseWith(jobResultInputSchema, raw);
  const jobId = input.job_id.trim();
  if (!jobId) throw new ValidationError("job_id must not be blank");
  return { jobId, waitSeconds: input.wait_seconds };
}

export function normalizeAbortRequest(raw) {
  const input = parseWith(jobAbortInputSchema, raw);
  const jobId = input.job_id.trim();
  if (!jobId) throw new ValidationError("job_id must not be blank");
  return { jobId };
}

export function normalizeListModelsRequest(raw) {
  const input = parseWith(listModelsInputSchema, raw);
  let search;
  if (input.search !== undefined) {
    search = input.search.trim();
    if (search === "") throw new ValidationError("search must not be blank");
    if (OPTION_LIKE.test(search) || search.startsWith("@")) {
      throw new ValidationError("search must not start with '-' or '@'");
    }
  }
  return { search };
}
