#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./config.mjs";
import { JobManager } from "./jobs.mjs";
import { listModels } from "./pi-models.mjs";
import {
  BUILTIN_TOOLS,
  THINKING_LEVELS,
  ValidationError,
  normalizeAbortRequest,
  normalizeDelegateRequest,
  normalizeJobResultRequest,
  normalizeListModelsRequest,
} from "./pi-args.mjs";

const config = loadConfig();
const manager = new JobManager({ config });
const lifecycle = new AbortController();

function combineSignals(...signals) {
  const active = signals.filter(Boolean);
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];
  const controller = new AbortController();
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

const delegateProperties = {
  task: {
    type: "string",
    description: "Task text sent to pi on stdin. Required and non-blank.",
  },
  model: {
    type: "string",
    description:
      "pi model as provider/model, for example magpie/opencode-go/beam-free. Omit or pass 'default' to use pi's configured default.",
  },
  thinking: {
    type: "string",
    enum: THINKING_LEVELS,
    description: "pi thinking level.",
  },
  cwd: {
    type: "string",
    description: "Absolute working directory for pi. Defaults to the MCP server's current directory.",
  },
  tools: {
    type: "string",
    description: `Comma-separated built-in tools from: ${BUILTIN_TOOLS.join(", ")}. Defaults to read,bash,edit,write.`,
  },
  session_id: {
    type: "string",
    description: "Continue an existing persisted pi session by id. Cannot be combined with ephemeral.",
  },
  ephemeral: {
    type: "boolean",
    description: "Run without persisting a session (pi --no-session). Cannot be combined with session_id.",
  },
  trust_project: {
    type: "boolean",
    description: "true passes --approve, false passes --no-approve. Omit to let pi decide.",
  },
  timeout_seconds: {
    type: "integer",
    minimum: 1,
    maximum: config.maxTimeoutSeconds,
    default: config.defaultTimeoutSeconds,
    description: "Execution time budget in seconds, counted from process start, not from queueing.",
  },
  wait_seconds: {
    type: "integer",
    minimum: 0,
    maximum: config.maxWaitSeconds,
    default: config.defaultWaitSeconds,
    description: "How long this MCP call waits for completion before returning a running job id.",
  },
};

const TOOLS = [
  {
    name: "pi_delegate",
    description:
      "Delegate a task to the pi coding agent. Runs one pi process in JSON mode and returns a job result. " +
      "If the job is still running when the wait expires, poll with pi_job_result. Jobs with the same working directory " +
      "or the same persisted session run one at a time. A session continuation runs in the session's own working directory. " +
      "pi runs with the OS user's permissions; the tools allowlist and cwd are not a sandbox.",
    inputSchema: {
      type: "object",
      properties: delegateProperties,
      required: ["task"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "pi_job_result",
    description:
      "Read a pi delegation job and wait up to wait_seconds for it to finish. wait_seconds 0 is an immediate status check. " +
      "Jobs live in memory only and do not survive an MCP server restart.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "Job id returned by pi_delegate." },
        wait_seconds: {
          type: "integer",
          minimum: 0,
          maximum: config.maxWaitSeconds,
          default: config.defaultWaitSeconds,
          description: "How long to wait for a terminal status.",
        },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "pi_job_abort",
    description:
      "Abort a queued or running pi job. Sends SIGTERM to the pi process group, then SIGKILL after 3 seconds. " +
      "Idempotent for jobs that already finished.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "Job id returned by pi_delegate." },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: "pi_list_models",
    description:
      "List the models pi has configured, optionally filtered by search text. The listing proves configuration, not that credentials work.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Optional filter passed to pi --list-models." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
];

function jsonResult(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function toolError(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}

function reportError(context, error) {
  process.stderr.write(`pi_subagent: ${context}: ${error?.stack ?? error}\n`);
}

async function handleDelegate(args, extra) {
  const signal = extra?.signal;
  if (signal?.aborted) return toolError("request cancelled");
  try {
    const request = normalizeDelegateRequest(args, config);
    const job = manager.delegate(request);
    let abortListener;
    if (signal) {
      abortListener = () => manager.abort(job.id);
      if (signal.aborted) abortListener();
      else signal.addEventListener("abort", abortListener, { once: true });
    }
    try {
      await manager.waitFor(job, request.waitSeconds, signal);
    } finally {
      if (abortListener) signal.removeEventListener("abort", abortListener);
    }
    return jsonResult(manager.result(job));
  } catch (error) {
    if (error instanceof ValidationError) return toolError(`invalid arguments: ${error.message}`);
    reportError("pi_delegate", error);
    return toolError(`pi_delegate failed: ${error.message}`);
  }
}

async function handleJobResult(args, extra) {
  try {
    const { jobId, waitSeconds } = normalizeJobResultRequest(args);
    const job = manager.get(jobId);
    if (!job) {
      return toolError(`No job with id "${jobId}". Jobs are kept in memory for one hour and do not survive a server restart.`);
    }
    await manager.waitFor(job, waitSeconds ?? config.defaultWaitSeconds, extra?.signal);
    return jsonResult(manager.result(job));
  } catch (error) {
    if (error instanceof ValidationError) return toolError(`invalid arguments: ${error.message}`);
    reportError("pi_job_result", error);
    return toolError(`pi_job_result failed: ${error.message}`);
  }
}

async function handleAbort(args, extra) {
  try {
    const { jobId } = normalizeAbortRequest(args);
    const job = manager.abort(jobId);
    if (!job) {
      return toolError(`No job with id "${jobId}". Jobs are kept in memory for one hour and do not survive a server restart.`);
    }
    await manager.waitFor(job, Math.ceil(config.killGraceMs / 1000) + 2, extra?.signal);
    return jsonResult(manager.result(job));
  } catch (error) {
    if (error instanceof ValidationError) return toolError(`invalid arguments: ${error.message}`);
    reportError("pi_job_abort", error);
    return toolError(`pi_job_abort failed: ${error.message}`);
  }
}

async function handleListModels(args, extra) {
  try {
    const { search } = normalizeListModelsRequest(args);
    const result = await listModels({
      piBin: config.piBin,
      search,
      timeoutMs: config.listModelsTimeoutMs,
      killGraceMs: config.killGraceMs,
      signal: combineSignals(lifecycle.signal, extra?.signal),
    });
    return jsonResult({
      models: result.models,
      count: result.models.length,
      stderr: result.stderr.trim() || null,
    });
  } catch (error) {
    if (error instanceof ValidationError) return toolError(`invalid arguments: ${error.message}`);
    reportError("pi_list_models", error);
    return toolError(`pi_list_models failed: ${error.message}`);
  }
}

const HANDLERS = new Map([
  ["pi_delegate", handleDelegate],
  ["pi_job_result", handleJobResult],
  ["pi_job_abort", handleAbort],
  ["pi_list_models", handleListModels],
]);

const server = new Server(
  { name: "pi_subagent", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const handler = HANDLERS.get(request.params.name);
  if (!handler) {
    return toolError(`Unknown tool "${request.params.name}".`);
  }
  return handler(request.params.arguments ?? {}, extra);
});

const transport = new StdioServerTransport();

let shuttingDown = false;
async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  lifecycle.abort();
  try {
    await manager.shutdown();
  } catch (error) {
    reportError("shutdown", error);
  }
  try {
    await server.close();
  } catch {}
  process.exit(exitCode);
}

transport.onclose = () => {
  void shutdown(0);
};
process.on("SIGTERM", () => {
  void shutdown(0);
});
process.on("SIGINT", () => {
  void shutdown(0);
});
process.stdin.on("end", () => {
  void shutdown(0);
});
process.on("uncaughtException", (error) => {
  reportError("uncaughtException", error);
  void shutdown(1);
});
process.on("unhandledRejection", (error) => {
  reportError("unhandledRejection", error);
  void shutdown(1);
});

await server.connect(transport);
