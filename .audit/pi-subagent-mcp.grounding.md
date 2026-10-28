# Grounding: pi as a Claude Code subagent

## Goal

Build a local stdio MCP server that lets Claude Code delegate a task to the `pi` coding agent, with a per-call model choice and full coding tools by default. Install at `~/github/astack/mcp_servers/pi-subagent/` and register it user-level with `claude mcp add --scope user`.

## Verified environment

- Claude Code 2.1.310, Node 24.20.0, npm 11.19.0.
- `pi` 1.4.0 at `/home/zdan/.nvm/versions/node/v24.20.0/bin/pi` (`@earendil-works/pi-coding-agent`).
- Pi's default provider and model come from `~/.pi/agent/settings.json`: `magpie` / `auto/deepseek-v4.1-flash`. `pi -p` and `pi --mode json` both work today.
- `@modelcontextprotocol/sdk` latest is 1.32.2 and accepts zod 3.25 or 4.
- `~/github/astack` is a git repo on `main` with remote `origin`. It is a skill library; `mcp_servers/` does not exist yet.

## pi interfaces that matter

- Modes: `-p` print, `--mode json` one-shot JSONL, `--mode rpc` long-lived JSONL. Print and JSON modes exit after the supplied prompt; RPC accepts more commands.
- JSON mode emits a session header, then `agent_start`, `turn_start`, `message_start`, `message_update`, `message_end`, `turn_end`, `agent_end`, `agent_settled`. Split on LF only. `message_update` contains deltas; `message_end` is authoritative.
- The final answer is the last assistant `message_end`. `agent_settled` means no automatic retry, compaction, or queued work remains.
- Tool events: `tool_execution_start` (`toolCallId`, `toolName`, `args`), `tool_execution_end` (`toolCallId`, `toolName`, `result`, `isError`, `durationMs`).
- Built-in default tools: `read`, `bash`, `edit`, `write`. `write` args are `{path, content}`. `edit` args are `{path, edits:[{oldText,newText}]}`. `--tools` with plain names replaces the whole selection; `--exclude-tools` removes by pattern.
- Model selection: `--model "provider/id"` (also accepts a fuzzy pattern and a `:<thinking>` suffix), `--provider` when paired with a plain model id, `--thinking off|minimal|low|medium|high|xhigh|max`. `pi --list-models [search]` prints a table with provider, model, context, max-out, thinking, images.
- Sessions: default persists; `--no-session` is ephemeral; `--session <path|id>` resumes; `--session-id <id>` creates or opens an exact project id. JSON mode's first record is `{type:"session", id, cwd}`.
- Project trust: `--approve` / `--no-approve`; without an override, non-interactive modes follow saved decisions or `defaultProjectTrust`. `AGENTS.md` and `CLAUDE.md` load regardless. Do not override trust unless the caller asks.
- Security: pi does not ask before every tool call and runs with the OS user's permissions. The MCP call is the approval gate.
- Usage per assistant message: `{input, output, cacheRead, cacheWrite, totalTokens, cost:{...}}`.

## Claude Code MCP facts

- Register with `claude mcp add --scope user <name> -- <command> [args...]`. Tool names become `mcp__<server>__<tool>`.
- The server's stdout is JSON-RPC. Diagnostics go to stderr only.
- MCP tool calls can hit a client timeout. Long work needs an async job plus polling rather than one blocking call.
- A user-level registration lands in the user's Claude config, not the project. The user can allowlist individual tools in permissions.

## Constraints from the user

- MCP server, not a skill or CLI-only wrapper.
- Full coding tools by default; callers can narrow with a tools parameter.
- Per-call model choice.
- Install under `~/github/astack/mcp_servers/`.

## Design questions the candidates must answer

1. One process per delegation (JSON mode) or one long-lived RPC process per project? Pick a base and justify.
2. How does a long task survive the MCP client timeout: async job plus poll, or configurable blocking wait?
3. What is the public tool surface, exactly? Names, params, result shape.
4. How is a write-capable job kept from colliding with another job in the same cwd?
5. How does a caller continue a prior pi session, and how does model switching work on continuation?
6. What is returned to Claude so the context stays small: final text, tool summary, changed files, usage, session id, event log path.
7. What is the failure contract for missing pi, bad model, bad cwd, timeout, abort, and pi crash?

## Rubric

- Correctness of pi process lifecycle and event aggregation.
- Simple, deep public surface; no wire types leak into tool params.
- Robust long-task handling without client timeouts.
- Per-call model selection that is easy to discover and hard to misuse.
- Clear security boundary and useful failure messages.
- Testable pure core; real end-to-end verification is possible.
