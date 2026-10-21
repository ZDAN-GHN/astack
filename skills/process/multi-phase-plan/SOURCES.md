# Sources and portable skill adaptation

The upstream source is [cursor/plugins pstack](https://github.com/cursor/plugins/tree/1dcc2bacde73ddd284803b7af28164d0436198fc/pstack), version 0.15.21 at commit `1dcc2bacde73ddd284803b7af28164d0436198fc`.

`references/upstream-multi-phase-plan.md` is copied byte for byte from `pstack/skills/poteto-mode/playbooks/multi-phase-plan.md`. `LICENSE` is copied byte for byte from `pstack/LICENSE`. The archived source is not active instructions and its upstream-only paths are not runtime dependencies.

The active detailed entry is `SKILL.md`. This is a user-requested, runtime-independent adaptation for autonomous decomposition and parallel execution, not a verbatim upstream skill. The upstream reference has zero changed lines.

The detailed entry, execution guidance, template, checker, tests, archived upstream source, and license were moved from `rules/multi-phase-plan/` into this skill. The short [companion rule](../../../rules/multi-phase-plan/multi-phase-plan.md) retains autonomous sizing, authorization boundaries, ownership, and integrated acceptance; complex work loads this skill for the full procedure. Detailed procedures have one source here.

During this split, the detailed entry replaced `alwaysApply: true` with skill `name` and `description`, and changed its opening applicability and reference-resolution prose from rule to skill. The template changed one reference from “planning rule” to “planning skill”. Execution guidance, checker, tests, archived upstream source, and license moved without content changes. This is a local derived skill; the archived upstream playbook has no skill frontmatter to preserve.

| Upstream requirement | Portable adaptation and reason |
| --- | --- |
| Plan only, always wait for an explicit go | Judge planning depth automatically; a plan-only request stops at the plan, while an implementation request continues within its existing authorization. |
| One section per PR | One section per verifiable unit, optionally a local diff, commit, or PR. Planning does not require publishing work. |
| Agent store's docs directory | User path or repository conventions, falling back to `docs/plans/`. |
| Cursor Task, pstack agent types, fixed models | Available delegation capabilities and user model policy; sequential execution when delegation is unavailable. |
| pstack autopilot and orchestration playbooks | Bundled `references/execution.md` with ownership, dependencies, integration, and evidence. |
| Cursor `/loop 1h` | Event-boundary audits; no scheduler implied by task tracking. |
| Ten live lanes per PR and one cloud VM per lane | Concrete scenarios selected by risk, using the actual available runtime and isolation. |
| `cursor-team-kit` control skills | Available surface drivers and commands recorded in the plan. Missing tools remain explicit gaps. |
| Unit, live, and perf mandatory for every PR | Live outcome verification always required; unit and perf N/A require concrete applicability reasons. |
| Operator screenshots and video review for every interaction PR | Existing user and repository review requirements; screenshots for changed interactions, video when motion matters and capture is available. |
| Ready PRs, forge resolution, Bugbot, babysit, no-comments | Apply the target repository's checks and review workflow when those capabilities exist and the actions are authorized. |
| technical-writing, unslop, how, interrogate, show-me-your-work | Optional installed skills; no dependency on uninstalled slash commands. |
| Upstream check-plan enforces ten lanes, PRs, `/loop`, and prose rules | Optional structural checker for the bundled template; no claim of runtime or semantic validation. |

The active skill and references have no agent-specific tool calls, status names, numeric-ID assumptions, worktree path, or scheduler requirement. Task persistence, concurrency displays, dependency handling, and reopening follow the host's actual capabilities. A Markdown checklist is a fallback when no task tracker exists.

The skill frontmatter uses `name` and `description`. The companion rule uses `description` and `alwaysApply: true`. Register the rule as always-on and install the skill using the receiving tool's supported mechanisms; no common discovery mechanism is assumed. Keep the skill's references and scripts beside its entry. Resolve repository links from the real file location when a rule is reached through a symlink. If installed separately, locate the skill by name in the host's skill directory.

`scripts/check-plan.mjs` is optional and requires Node.js only when run. For plans using the bundled template, it checks required sections, unit fields, placeholders, and dependency IDs and cycles. Without Node.js, inspect those structurally. Neither path verifies evidence quality, write-boundary overlap, runtime feasibility, or software behavior.
