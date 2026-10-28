# Design contract: pi_subagent MCP server

Status: implementation contract. The RPC candidate completed; the independent JSON candidate was stopped without a design output after tool-classifier failures. The parent compared its existing JSON sketch with the RPC candidate. This is not a completed independent arena verdict. JSON mode is the selected smaller implementation; independent code review remains required.

## Implementation corrections

These supersede conflicting draft text below.

- Never commit, push, or change permission settings. The user requested local implementation.
- Jobs are serialized by canonical real cwd, including symlink aliases. Do not expose `concurrent` in this version. Resume of the same persisted session must not run concurrently either.
- Use an explicit built-in default `read,bash,edit,write`. Start with `--no-extensions --no-mcp` so delegation does not silently activate global plugins, nested delegation, or MCP servers. Explain this deliberate isolation in README. Keep pi model/credential configuration, skills and context files available. Verify custom-provider model lookup still works with these flags.
- Tool narrowing is not an OS sandbox. Neither cwd, project trust nor the MCP approval isolates filesystem or network permissions. Do not change project trust automatically. No permission bypasses.
- A clean process exit, an actual assistant message, an observed `agent_settled`, no error/aborted stop reason, and no settled aborted flag are all required for `completed`. Never call a nonzero exit or signal successful. A `length` response must carry an explicit partial-output warning.
- Track files only after successful built-in edit/write completion. Call the list observed tool writes, not a complete git diff; bash and external processes can change additional files.
- Retain bounded output, stderr, pending tool metadata and line buffers. Ignore unknown well-formed events but fail malformed JSON/protocol framing. Stream the raw log with backpressure and fail log-write errors safely. Create log directories 0700 and files 0600.
- Avoid orphaned descendants. On Linux start an owned process group and terminate the whole group on abort, timeout, MCP stdin EOF and SIGTERM, with bounded TERM-to-KILL escalation. Verify process exit before starting a queued conflicting job.
- Use PI_SUBAGENT_PI_BIN or `pi` on PATH. Do not search arbitrary nvm versions. The registration command may pin the already verified executable path. No shell interpolation.
- Timeout starts at execution, not while queued. Abort is idempotent. A tool wait expiring returns a live job id without aborting it; server shutdown does abort live jobs. In-memory jobs do not survive server restart.
- Separate the ephemeral exact-token test from the persisted-session continuation test. An ephemeral session cannot be resumed. Use only the previously verified free model for opt-in live tests; no paid/default model calls without approval.
- The tool schema rejects blank tasks, unknown input fields, option-injection strings, incompatible ephemeral/session arguments and invalid bounds. Keep model resolution delegated to pi, return the actual model from events. Validate tools against built-in tool names for this isolated version.
- Build the smallest coherent modules necessary; the six-file draft map is not a mandatory file count.

## Usage first

```js
// A coding task on a chosen model
pi_delegate({
  task: "Fix the failing test in src/foo.test.js and run it",
  model: "magpie/auto/deepseek-v4.1-flash",
  cwd: "/home/zdan/repo"
})

// A read-only review with a narrower tool set
pi_delegate({
  task: "Review the current diff for race conditions. Report only.",
  tools: "read,grep,find,ls"
})

// Continue the same pi session with a follow-up
pi_delegate({
  task: "Now add a regression test for that case",
  session_id: "01a17852-8866-73b3-989c-44effee37a77"
})

// A long task: first call returns running, then poll
pi_delegate({ task: "Migrate every call site", timeout_seconds: 3600 })
// → { status: "running", job_id: "..." }
pi_job_result({ job_id: "...", wait_seconds: 45 })
```

## Public MCP surface

Server name `pi_subagent`. Tools:

| Tool | Purpose |
|---|---|
| `pi_delegate` | Start a pi task and wait up to `wait_seconds`. |
| `pi_job_result` | Read a job; wait up to `wait_seconds`; `0` is a status check. |
| `pi_job_abort` | Kill a queued or running job. |
| `pi_list_models` | List pi's configured models, optionally filtered. |

## Types

```ts
type JobStatus = "queued" | "running" | "completed" | "failed" | "aborted" | "timeout";

interface DelegateRequest {
  task: string;
  model?: string;              // "default" or a pi model pattern like "provider/id"
  thinking?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
  cwd?: string;
  tools?: string;              // pi --tools allowlist, e.g. "read,grep,find,ls"
  session_id?: string;         // continue an existing pi session
  ephemeral?: boolean;         // pi --no-session
  trust_project?: boolean;     // true -> --approve, false -> --no-approve, unset -> pi's own decision
  timeout_seconds?: number;    // execution budget, default 1800, max 7200
  wait_seconds?: number;       // 0..55, default 45
  concurrent?: boolean;        // default false: serialize jobs per cwd
}

interface DelegationResult {
  job_id: string;
  status: JobStatus;
  text: string;
  text_truncated: boolean;
  model: { provider: string; id: string } | null;
  session_id: string | null;
  stop_reason: string | null;
  usage: UsageTotals | null;
  tool_calls: ToolCallSummary[];
  tool_calls_truncated: boolean;
  changed_files: string[];
  duration_ms: number;
  error: string | null;
  stderr_tail: string | null;
  events_path: string;
  hint?: string;
}

interface ToolCallSummary {
  name: string;
  target: string | null;
  ok: boolean;
  duration_ms: number | null;
}

interface UsageTotals {
  input: number;
  output: number;
  cache_read: number;
  cache_write: number;
  total: number;
  cost_total: number;
}
```

While queued or running the result carries empty text and `hint: "call pi_job_result"`.

## Module map

| File | Owns |
|---|---|
| `src/config.mjs` | Env defaults, cache path, limits. |
| `src/pi-args.mjs` | Request validation and `buildPiArgs`. Pure. |
| `src/pi-events.mjs` | Event accumulator and final result derivation. Pure. |
| `src/pi-models.mjs` | `pi --list-models` execution and table parsing. |
| `src/jobs.mjs` | Job registry, per-cwd queue, child process lifecycle, timeout, abort, event log. |
| `src/server.mjs` | MCP server, tool registration, handlers, shutdown. |

Tests live in `test/`. `test/fixtures/fake-pi.mjs` is a scriptable pi stand-in.

## Process contract

Spawn once per delegation:

```js
spawn(piBin, args, {
  cwd,
  env: process.env,
  stdio: ["pipe", "pipe", "pipe"]
})
```

The task goes to stdin, then stdin closes. It never goes on argv, so `ARG_MAX`, a leading `-`, and a leading `@` cannot change its meaning.

`buildPiArgs`:

- Always `--mode json`.
- `--no-session` when `ephemeral`.
- `--session <id>` when `session_id`; reject `session_id` plus `ephemeral`.
- `--model <model>` when `model` is set and not `"default"`.
- `--thinking <level>` when set.
- `--tools <list>` when set.
- `--approve` / `--no-approve` only when `trust_project` is set.
- No prompt argument.

## Event handling

- Split stdout on LF only, strip an optional CR. Never use readline.
- Write every raw line to `~/.cache/pi-subagent/runs/<job_id>.jsonl`.
- `session` sets `session_id`.
- Assistant `message_end` is authoritative. Capture text blocks, provider, model, stopReason, errorMessage, and usage. Sum usage across assistant messages.
- Text comes only from `content[].type === "text"` blocks. `thinking` blocks are dropped, and they arrive with ANSI escapes in this environment (verified: a `thinking` block contained `\u001b[38;5;5m`), so never truncate on raw content length before filtering.
- `tool_execution_start` records `{toolCallId, name, target}`. Target comes from `args.path` for edit/write, `args.command` for bash, `args.pattern` for grep/find, truncated to 120 chars.
- `tool_execution_end` fills `ok` and `duration_ms`. For `write` and `edit`, resolve `args.path` against cwd and add it to `changed_files`.
- `agent_settled` marks the run settled.
- Any other event is ignored by the accumulator and kept only in the event log.

## Status derivation

- `aborted` when the caller aborted.
- `timeout` when the execution timer fired.
- `completed` when settled and stopReason is not `"error"`.
- `failed` otherwise, with `stderr_tail` and a concrete `error`.

A `length` stop reason stays `completed` with `stop_reason: "length"`; the text is partial but usable. A nonzero exit with settled text is still `completed` unless the stop reason is `error`.

## Verified behavior

Measured against pi 1.4.0 on this machine:

- A prompt on stdin with no positional argument is accepted in JSON mode.
- `--tools write` really does restrict the tool set. With only `read` enabled, the model reported no write tool and created no file.
- `--session <unknown-id>` exits 1 with `No session found matching '<id>'` on stderr and no JSON on stdout. Treat nonzero exit with no session record as a pre-run failure, not a run failure.
- `--session-id <new-id>` creates a session in the current project and warns on stderr. `--session <id>` then continues it.
- `--model "magpie/opencode-go/beam-free"` works with no extra flags. `--model "anthropic/claude-haiku-4-5"` is listed but returns `401 Invalid bearer token` in this environment, so list-models output proves configuration, not credentials.
- pi cold start is about 2.6 to 3.2 seconds, which is the cost a per-delegation process pays every call.
- A real write run produced `tool_execution_start` with `args {content, path}` and `tool_execution_end` with `isError: false`, and the file landed on disk.

## Concurrency

Jobs that may write are serialized per resolved cwd. A second job stays `queued` until the first settles. `concurrent: true` bypasses the queue. The queue key is the resolved cwd, not the caller's spelling.

## Limits

- Text capped at `PI_SUBAGENT_MAX_TEXT_CHARS` (default 50000), with `text_truncated`.
- Tool calls capped at `PI_SUBAGENT_MAX_TOOL_CALLS` (default 100), with `tool_calls_truncated`.
- Finished jobs kept for one hour, at most 50; oldest finished evicted.
- Abort sends SIGTERM, then SIGKILL after 3 seconds.
- Server shutdown aborts every live job.

## Model selection

- `model` is passed straight to pi, which validates it and exits 1 with a clear message when unknown.
- `"default"` or omitted leaves pi's own default model in charge.
- `pi_list_models` runs `pi --list-models [filter]` with a 15 second timeout and parses the aligned table. Listing reflects configuration, not authentication.
- `thinking` maps to `--thinking`.

## Decisions

- Base: one JSON-mode process per delegation, async job manager. Simpler lifecycle, crash isolation, no idle supervisor. RPC is deferred until live steering or mid-run model switching is required.
- Task via stdin, not argv.
- Persisted sessions by default; the caller receives the session id for continuation.
- Per-cwd serialization by default; concurrency is explicit.
- Full built-in tools by default (`read`, `bash`, `edit`, `write`), plus whatever the user's pi configuration enables.
- No model presets. Explicit model strings plus listing are enough.
- No job persistence across server restarts.
- Project trust is pi's decision unless the caller overrides it.

## Security

Pi runs with the OS user's permissions and does not confirm each tool call. The MCP call is the approval gate. The README states this plainly, recommends `tools` narrowing and `cwd` scoping, and warns that `events_path` contains the full transcript.
