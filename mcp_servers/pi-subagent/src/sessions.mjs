import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";
import { ValidationError } from "./errors.mjs";

const MAX_HEADER_BYTES = 1024 * 1024;

function expandTilde(value) {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/") || value.startsWith("~\\")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function readSettingsSessionDir(agentDir) {
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(agentDir, "settings.json"), "utf8"));
    const value = settings?.sessionDir;
    return typeof value === "string" && value.trim() !== "" ? value : null;
  } catch {
    return null;
  }
}

// Mirrors pi's lookup order: PI_CODING_AGENT_SESSION_DIR, then the agent
// settings sessionDir, then the per-project directories under the agent dir.
export function resolveSessionStore(env = process.env) {
  const envDir = env.PI_CODING_AGENT_SESSION_DIR;
  if (envDir) return { kind: "flat", dir: path.resolve(expandTilde(envDir)) };
  const agentDir = env.PI_CODING_AGENT_DIR
    ? path.resolve(expandTilde(env.PI_CODING_AGENT_DIR))
    : path.join(os.homedir(), ".pi", "agent");
  const settingsDir = readSettingsSessionDir(agentDir);
  if (settingsDir) return { kind: "flat", dir: path.resolve(expandTilde(settingsDir)) };
  return { kind: "default", root: path.join(agentDir, "sessions") };
}

function readFirstLine(file) {
  let fd;
  try {
    fd = fs.openSync(file, "r");
    const decoder = new StringDecoder("utf8");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let text = "";
    let total = 0;
    while (total < MAX_HEADER_BYTES) {
      const length = Math.min(buffer.length, MAX_HEADER_BYTES - total);
      const read = fs.readSync(fd, buffer, 0, length, null);
      if (read === 0) {
        text += decoder.end();
        break;
      }
      total += read;
      text += decoder.write(buffer.subarray(0, read));
      const newline = text.indexOf("\n");
      if (newline !== -1) return text.slice(0, newline);
    }
    return text.split("\n", 1)[0];
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }
}

function readSessionHeader(file) {
  const line = readFirstLine(file);
  if (!line) return null;
  try {
    const header = JSON.parse(line);
    if (header && header.type === "session" && typeof header.id === "string") return header;
  } catch {}
  return null;
}

function defaultSessionDir(root, cwd) {
  return path.join(root, `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`);
}

function candidateDirs(store, requestedCwd) {
  if (store.kind === "flat") return [store.dir];
  const dirs = [];
  if (requestedCwd) dirs.push(defaultSessionDir(store.root, requestedCwd));
  let entries = [];
  try {
    entries = fs.readdirSync(store.root, { withFileTypes: true });
  } catch {}
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(store.root, entry.name);
    if (!dirs.includes(dir)) dirs.push(dir);
  }
  return dirs;
}

function findMatches(store, sessionId, requestedCwd) {
  const suffix = `_${sessionId}.jsonl`;
  const matches = [];
  for (const dir of candidateDirs(store, requestedCwd)) {
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith(suffix)) continue;
      const file = path.join(dir, name);
      const header = readSessionHeader(file);
      if (header?.id === sessionId) matches.push({ file, header });
    }
  }
  return matches;
}

function canonicalDirectory(value) {
  try {
    const resolved = fs.realpathSync(value);
    return fs.statSync(resolved).isDirectory() ? resolved : null;
  } catch {
    return null;
  }
}

function projectList(matches) {
  return [...new Set(matches.map(({ header }) => (typeof header.cwd === "string" ? header.cwd : "unknown")))].join(", ");
}

export function resolveSession({ sessionId, requestedCwd, store = resolveSessionStore() }) {
  const matches = findMatches(store, sessionId, requestedCwd);
  if (matches.length === 0) {
    throw new ValidationError(
      `session "${sessionId}" was not found in pi's session store. Check the exact id, or create the session first. Ephemeral sessions cannot be continued.`,
    );
  }

  let selected;
  if (requestedCwd) {
    const exact = matches.filter(({ header }) => canonicalDirectory(header.cwd) === requestedCwd);
    if (exact.length === 1) {
      selected = exact[0];
    } else if (exact.length > 1) {
      throw new ValidationError(`session "${sessionId}" matches multiple session files in ${requestedCwd}; refusing to guess.`);
    } else {
      throw new ValidationError(
        `session "${sessionId}" belongs to ${projectList(matches)}, not to cwd ${requestedCwd}. Omit cwd to use the session's own working directory, or pass the matching cwd.`,
      );
    }
  } else if (matches.length === 1) {
    selected = matches[0];
  } else {
    throw new ValidationError(
      `session "${sessionId}" exists in multiple projects (${projectList(matches)}); pass cwd to select one.`,
    );
  }

  const cwd = canonicalDirectory(selected.header.cwd);
  if (!cwd) {
    throw new ValidationError(
      `session "${sessionId}" has no accessible working directory (${selected.header.cwd ?? "missing"}). Restore it or start a new session.`,
    );
  }
  return { id: sessionId, path: path.resolve(selected.file), cwd };
}
