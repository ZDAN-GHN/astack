import path from "node:path";

export class ProtocolError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProtocolError";
  }
}

const MAX_TARGET_CHARS = 120;
const MAX_STORED_MESSAGES = 500;
const MAX_STORED_TOOL_CALLS = 1000;
const MAX_PENDING_PATHS = 200;
const MAX_STORED_CHANGED_FILES = 200;

export function extractText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const block of content) {
    if (block && block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("\n");
}

function toNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function addUsage(totals, usage) {
  if (!usage || typeof usage !== "object") return false;
  const input = toNumber(usage.input);
  const output = toNumber(usage.output);
  const cacheRead = toNumber(usage.cacheRead);
  const cacheWrite = toNumber(usage.cacheWrite);
  const total = typeof usage.totalTokens === "number" ? toNumber(usage.totalTokens) : input + output + cacheRead + cacheWrite;
  totals.input += input;
  totals.output += output;
  totals.cache_read += cacheRead;
  totals.cache_write += cacheWrite;
  totals.total += total;
  totals.cost_total += usage.cost && typeof usage.cost === "object" ? toNumber(usage.cost.total) : 0;
  return true;
}

function toolTarget(name, args) {
  if (!args || typeof args !== "object") return null;
  let value = null;
  if (name === "bash") value = args.command;
  else if (name === "grep" || name === "find") value = args.pattern;
  else if (name === "read" || name === "edit" || name === "write" || name === "ls") value = args.path;
  else value = args.path ?? args.command ?? args.pattern;
  if (typeof value !== "string") return null;
  return value.length > MAX_TARGET_CHARS ? value.slice(0, MAX_TARGET_CHARS) : value;
}

export class EventAccumulator {
  constructor({ cwd, maxToolCalls = 100, maxTextChars = 50000 }) {
    this.cwd = cwd;
    this.maxToolCalls = maxToolCalls;
    this.maxTextChars = maxTextChars;
    this.sessionId = null;
    this.settled = false;
    this.settledAborted = false;
    this.messages = [];
    this.lastText = "";
    this.lastTextTruncated = false;
    this.usage = { input: 0, output: 0, cache_read: 0, cache_write: 0, total: 0, cost_total: 0 };
    this.hasUsage = false;
    this.toolCalls = [];
    this.totalToolCalls = 0;
    this.toolCallIndex = new Map();
    this.pendingPaths = new Map();
    this.changedFiles = new Set();
    this.changedFilesTruncated = false;
  }

  handle(line) {
    if (line.trim() === "") return;
    let event;
    try {
      event = JSON.parse(line);
    } catch (error) {
      throw new ProtocolError(`invalid JSON event: ${error.message}`);
    }
    if (!event || typeof event !== "object" || Array.isArray(event) || typeof event.type !== "string") {
      throw new ProtocolError("event is not an object with a string type");
    }

    switch (event.type) {
      case "session":
        if (typeof event.id === "string") this.sessionId = event.id;
        break;
      case "message_end":
        this.handleMessageEnd(event);
        break;
      case "tool_execution_start":
        this.handleToolStart(event);
        break;
      case "tool_execution_end":
        this.handleToolEnd(event);
        break;
      case "agent_settled":
        this.settled = true;
        this.settledAborted = event.aborted === true;
        break;
      default:
        break;
    }
  }

  handleMessageEnd(event) {
    const message = event.message;
    if (!message || typeof message !== "object" || message.role !== "assistant") return;
    const usage = message.usage;
    const fullText = extractText(message.content);
    const textTruncated = fullText.length > this.maxTextChars;
    if (fullText !== "") {
      this.lastText = textTruncated ? fullText.slice(0, this.maxTextChars) : fullText;
      this.lastTextTruncated = textTruncated;
    }
    this.messages.push({
      provider: typeof message.provider === "string" ? message.provider : null,
      model: typeof message.model === "string" ? message.model : null,
      stopReason: typeof message.stopReason === "string" ? message.stopReason : null,
      errorMessage: typeof message.errorMessage === "string" ? message.errorMessage : null,
    });
    if (this.messages.length > MAX_STORED_MESSAGES) this.messages.shift();
    if (addUsage(this.usage, usage)) this.hasUsage = true;
  }

  handleToolStart(event) {
    this.totalToolCalls += 1;
    const id = typeof event.toolCallId === "string" ? event.toolCallId : null;
    const name = typeof event.toolName === "string" ? event.toolName : "unknown";
    const argsPath = event.args && typeof event.args.path === "string" ? event.args.path : null;
    const entry = {
      id,
      name,
      target: toolTarget(name, event.args),
      ok: null,
      durationMs: null,
      argsPath,
    };
    if (this.toolCalls.length < MAX_STORED_TOOL_CALLS) {
      this.toolCalls.push(entry);
      if (id) this.toolCallIndex.set(id, entry);
    }
    if (id && argsPath) {
      this.pendingPaths.set(id, argsPath);
      if (this.pendingPaths.size > MAX_PENDING_PATHS) {
        this.pendingPaths.delete(this.pendingPaths.keys().next().value);
      }
    }
  }

  handleToolEnd(event) {
    const id = typeof event.toolCallId === "string" ? event.toolCallId : null;
    const name = typeof event.toolName === "string" ? event.toolName : "unknown";
    let entry = id ? this.toolCallIndex.get(id) : null;
    if (!entry) {
      entry = { id, name, target: null, ok: null, durationMs: null, argsPath: this.pendingPaths.get(id) ?? null };
      if (this.toolCalls.length < MAX_STORED_TOOL_CALLS) this.toolCalls.push(entry);
    }
    entry.ok = event.isError !== true;
    entry.durationMs =
      typeof event.durationMs === "number" && Number.isFinite(event.durationMs) ? event.durationMs : null;
    if (entry.ok && (entry.name === "write" || entry.name === "edit") && entry.argsPath) {
      if (this.changedFiles.size < MAX_STORED_CHANGED_FILES) {
        this.changedFiles.add(path.resolve(this.cwd, entry.argsPath));
      } else {
        this.changedFilesTruncated = true;
      }
    }
    if (id) {
      this.toolCallIndex.delete(id);
      this.pendingPaths.delete(id);
    }
  }

  finalStopReason() {
    for (let index = this.messages.length - 1; index >= 0; index -= 1) {
      const reason = this.messages[index].stopReason;
      if (reason) return reason;
    }
    return null;
  }

  finalErrorMessage() {
    for (let index = this.messages.length - 1; index >= 0; index -= 1) {
      const message = this.messages[index].errorMessage;
      if (message) return message;
    }
    return null;
  }

  finalModel() {
    for (let index = this.messages.length - 1; index >= 0; index -= 1) {
      const { provider, model } = this.messages[index];
      if (provider || model) return { provider, id: model };
    }
    return null;
  }

  summarize() {
    const rawText = this.lastText;
    const textTruncated = this.lastTextTruncated || rawText.length > this.maxTextChars;
    const text = rawText.length > this.maxTextChars ? rawText.slice(0, this.maxTextChars) : rawText;
    const returnedToolCalls = Math.min(this.toolCalls.length, this.maxToolCalls);
    const toolCallsTruncated = this.totalToolCalls > returnedToolCalls;
    return {
      text,
      text_truncated: textTruncated,
      model: this.finalModel(),
      session_id: this.sessionId,
      stop_reason: this.finalStopReason(),
      error_message: this.finalErrorMessage(),
      usage: this.hasUsage ? { ...this.usage } : null,
      tool_calls: this.toolCalls.slice(0, this.maxToolCalls).map((call) => ({
        name: call.name,
        target: call.target,
        ok: call.ok === true,
        duration_ms: call.durationMs,
      })),
      tool_calls_truncated: toolCallsTruncated,
      changed_files: [...this.changedFiles],
      changed_files_truncated: this.changedFilesTruncated,
      assistant_messages: this.messages.length,
      settled: this.settled,
      settled_aborted: this.settledAborted,
    };
  }
}
