# Implementation brief: pi_subagent MCP server

Read the poteto-mode skill in full before any work:
`/home/zdan/.claude/plugins/cache/pstack-claude/pstack/0.9.102/skills/poteto-mode/SKILL.md`

## Scope

Create a new project at `mcp_servers/pi-subagent/` inside your isolated worktree of `~/github/astack`. It is a local stdio MCP server that lets Claude Code delegate a task to the `pi` coding agent.

Read the design contract at `/home/zdan/github/astack/.audit/pi-subagent-mcp.design.md`. It is the contract. Deviate only with a stated reason.

Do not write outside `mcp_servers/pi-subagent/` in your worktree. Do not register the MCP server or touch the user's Claude config.

## Stack

- Node 24, plain ESM JavaScript, no build step, no TypeScript.
- `@modelcontextprotocol/sdk` 1.32.2, `zod` 4.6.7.
- `node --test` for tests.
- The MCP server uses `StdioServerTransport`. Stdout is JSON-RPC only; diagnostics go to stderr.

## Files

```
mcp_servers/pi-subagent/
  package.json
  package-lock.json
  README.md
  .gitignore
  src/config.mjs
  src/pi-args.mjs
  src/pi-events.mjs
  src/pi-models.mjs
  src/jobs.mjs
  src/server.mjs
  test/pi-args.test.mjs
  test/pi-events.test.mjs
  test/pi-models.test.mjs
  test/jobs.test.mjs
  test/mcp-e2e.test.mjs
  test/fixtures/fake-pi.mjs
```

## Behavior contract

Implement the design contract exactly for:

- Tool names and parameter names: `pi_delegate`, `pi_job_result`, `pi_job_abort`, `pi_list_models`.
- Request and result shapes, status values, usage totals, tool-call summaries, changed files.
- `buildPiArgs` and task delivery over stdin. Never put the task on argv.
- JSONL parsing on LF only, with optional CR stripping.
- Event log at `~/.cache/pi-subagent/runs/<job_id>.jsonl`.
- Per-cwd queue, `concurrent` opt-out, timeout, abort escalation, shutdown cleanup.
- Model pass-through, `"default"`, `thinking`, `session_id`, `ephemeral`, `trust_project`.
- Result truncation and job retention limits.
- Clear errors for missing pi, bad cwd, invalid session id, invalid model, crash, timeout.

## Test gates

1. `npm test` must pass with no real pi process:
   - Reducer fixtures for text, usage, tool calls, changed files, failure, abort.
   - `buildPiArgs` matrix.
   - Model table parser.
   - Fake-pi job tests for success, failure, timeout, abort, queue order.
   - MCP protocol test using the fake pi through `StdioClientTransport`.
2. `PI_SUBAGENT_E2E=1 npm test` must pass against real pi:
   - `pi_list_models` finds `magpie/opencode-go/beam-free`.
   - `pi_delegate` with `model: "magpie/opencode-go/beam-free"`, `ephemeral: true` asks for an exact token and returns `completed` with that token and the requested model.
   - A write task in a fresh temp cwd with `tools: "write"` creates `proof.txt` with known content, and `changed_files` includes it.
   - A second delegation with `session_id` from the first recalls the first token, proving continuation.

Use `magpie/opencode-go/beam-free` for real-model tests; it is authenticated and free in this environment. Anthropic models are listed but currently return 401.

## Success criteria

- A reviewer can read `README.md` and register the server with one command.
- `npm test` passes from a clean `npm install`.
- The real e2e output proves model selection, file writing, and session continuation.
- No stdout writes outside the MCP transport.
- No comments that narrate phases or restate code.

## Report

Return the absolute worktree path, all created file paths, the exact `npm test` summary, and any deviation from the design with its reason. Do not commit or push. Do not run real-model tests yet; the parent owns opt-in real verification. Make them runnable. The implementation-corrections section in the design contract supersedes older behavior and testing instructions in this brief.
