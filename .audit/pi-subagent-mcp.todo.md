# pi-subagent MCP server

## Feature playbook steps

1. `how` over the affected subsystem.
2. `architect` for parallel design exploration.
3. Write the throughput checkpoint as four todo items.
4. Delegate code-writing to a subagent using the configured feature model with a specific scope and success criteria.
5. Verify on the matching surface. "Inconclusive" or wrong-surface is not a pass.
6. Rebase into small, ordered commits.
7. If the design is contested, `interrogate` before shipping.
8. Run **Opening a PR**.

## Step notes

- Step 1: done directly from pi 1.4.0 and Claude Code 2.1.310 docs, plus a live JSON-mode run. Grounding is in `.audit/pi-subagent-mcp.grounding.md`.
- Step 2: the RPC design completed. The independent JSON candidate was stopped without output during permission-classifier outages. The parent compared its JSON sketch with the RPC design; no independent cross-judge has run. Do not count this as a completed arena verdict.
- Step 4: delegate one implementation owner in an isolated worktree. Tests and README belong to the same owner because they share the job and event types. No commits or pushes.
- Step 6: skip: the user did not ask for commits, and the harness rule is to commit only on request.
- Step 7: skip: no contested design remained after synthesis.
- Step 8: skip: no commit or push was requested; files stay uncommitted.

## Throughput checkpoint

- **Blocking first steps.** Grounding, two design sketches, synthesis. No code until the job, event, and result shapes are fixed.
- **Independent workstreams.** n/a: one owner writes src, tests, and README because splitting duplicates the shared types.
- **Shared mutable state.** One writer in an isolated worktree. At runtime the server serializes jobs by canonical cwd and prevents concurrent continuation of the same persisted session. No concurrency opt-out.
- **Smallest safe decomposition.** One implementation owner. The core reducer, process runner, and MCP wiring share one request/result contract.

## Task todos

- [x] Write and review the grounding brief.
- [x] Run two design candidates in parallel. One completed, one stopped without a design; not an independent arena verdict.
- [x] Synthesize the design and fix the type sketch. Implementation corrections address exit status, tool isolation, canonical paths and descendant cleanup.
- [x] Delegate implementation in a worktree. The delegate was stopped by the user; no files were written.
- [x] Implement directly in the main workspace after the user asked for direct work.
- [x] Run deterministic tests (65 pass) and the opt-in live pi tests (5 pass, free beam-free model).
- [x] Independent review of the delivered code. Two reviewers returned; confirmed defects were fixed and covered by regression tests.
- [x] Register the server with `claude mcp add --scope user`.
- [x] Verify tool discovery and one real delegation through the MCP interface.
- [ ] Write the handoff with install, usage, and security notes.

## Independent review outcomes

Fixed from the bug review:

- Session continuation now resolves the exact session file in pi's store and passes an absolute path to `--session`. This prevents pi's interactive cross-project fork prompt from consuming the task text on stdin. A session job always runs in the session's own cwd; a conflicting explicit cwd is rejected. Covered by `test/sessions.test.mjs`, updated jobs tests and the live session test.
- Timeout and abort no longer override a run whose process already exited. The execution timer is cleared on the child `exit` event and checked against `exitCode`/`signalCode`; abort is a no-op after exit. Regression tests use a delayed event-log writer.
- Session IDs are exact (pi's validation pattern, no prefixes, no path fallback). `.jsonl`-style path input is resolved only as a session id.
- MCP request cancellation is handled. `pi_delegate` aborts its job, `pi_job_result` returns early, and `pi_list_models` kills its child. Covered by an SDK-client cancellation test.
- Tool dispatch uses a `Map`, so `constructor`, `toString`, `__proto__`, and `hasOwnProperty` are rejected as unknown tools.
- Event-log drain has a timeout and a close listener; stdout/stderr stream errors are handled without masking the original log error.
- Lower-severity items fixed: shutdown grace timer cleared; new delegations rejected during shutdown; stdin warnings on successful runs; tool-call truncation reflects the storage cap; `@`-prefixed model search rejected; README documents unbounded log retention.
- `pi_list_models` children are cancelled on shutdown through the lifecycle signal; its SIGKILL grace uses `config.killGraceMs`.

Fixed from the code-quality review:

- Timeout and wait limits now derive from `LIMITS`/config in zod, the advertised MCP schema, and runtime clamping.
- Log failure state is centralized in `logFailure`; early spawn failure uses one predicate.
- Shutdown has a test that aborts a live job and kills its grandchild.
- `EventAccumulator` stores only message metadata plus the last non-empty text; raw per-message usage is not retained. Changed files are capped at 200 with `changed_files_truncated`.
- `parseModelTable` stops at the blank line after the table, so trailing prose is not parsed as a model.
- Queue depth is capped at 50; the limit is documented.
- The MCP e2e test restores the fixture mode after chmod; `handleAbort` waits based on `killGraceMs`.

Accepted, not fixed:

- Invalid `PI_SUBAGENT_MAX_*` values still fall back silently; low impact and would add diagnostics plumbing.
- No unit test for `pi_list_models` timeout/large-output paths; the real list-models path is covered by MCP and live tests.
- `JobManager.result()` remains a thin alias of `buildResult()`; used widely in tests, no functional risk.
- Handler try/catch duplication in `server.mjs`; four tools do not justify a wrapper yet.

Known deviations from the design type sketch, now also in README: `warnings[]` was added, `events_path` is null for jobs that never started, and `changed_files_truncated` was added.

