---
name: multi-phase-plan
description: Plan and execute complex work with independent deliverables, cross-component contracts, migrations, concurrent writers, or handoffs. Decompose precise units, coordinate dependencies and ownership, and verify the integrated outcome.
---

# Multi-phase planning and execution

Use this skill when the task needs decomposition, coordination, or a durable plan. Deliver the user's outcome through the smallest verifiable units. The main agent owns decomposition, coordination, integration, and final acceptance.

This skill is independent of the agent runtime. Use available task tracking, delegation, editing, and verification capabilities according to their actual contracts. If delegation is unavailable, execute the units sequentially. A task tool is optional; a Markdown checklist can track the same work.

Resolve relative references from this skill file's directory. The requirements below are self-contained. For a durable multi-phase plan, use [the plan template](references/plan-template.md) and [execution guidance](references/execution.md). [SOURCES.md](SOURCES.md) records provenance and adaptations. The archived upstream playbook is source material, not active instructions.

## Decide how much planning is needed

- Inspect the request, owning code, callers, contracts, tests, and current workspace before dividing work. Establish the observable outcome, constraints, and existing user changes.
- For a small, understood change with one acceptance target, work directly with proportionate verification. Do not create a large plan or artificial parallelism merely because multiple files are involved.
- Use a brief task list for several straightforward steps. Use a durable plan when there are independent deliverables, cross-component contracts, migrations, concurrent writers, meaningful technical uncertainty, or work that must survive a handoff.
- If the user requested implementation, create the necessary plan and continue within that authorization. If the user requested only a plan or expressly required approval before implementation, deliver the plan and stop at that boundary. Planning does not require a second permission for already authorized implementation.
- Resolve observable technical uncertainty through inspection or bounded experiments before dependent work starts. Record the result and remaining uncertainty. Ask about consequential product choices or missing information that evidence cannot settle.

## Decompose before dispatch

Record four decisions for multi-phase work. Identify blocking steps, independent workstreams, shared mutable state, and the smallest safe decomposition. Explain a single owner or an inapplicable dimension. Revisit these decisions when the evidence changes.

Each unit must have all of the following.

| Field | Required content |
| --- | --- |
| Outcome | One concrete artifact or observable behavior needed for the user's goal. |
| Owner | One responsible agent or execution role. The main agent retains final acceptance. |
| Inputs | Required contracts, files, base revision, and predecessor artifacts. |
| Write boundary | Specific files or globs and any shared-resource restrictions. |
| Dependencies | Stable unit IDs and the result that makes the unit ready. No cycles. |
| Acceptance | A command or procedure, expected result, and evidence location. |
| Handoff | Changed files, revision or diff identity, actual checks, open findings, and next consumer. |

Split by independently testable behavior or contract, rather than arbitrary file counts or equal-sized lists. A unit should be small enough to complete, inspect, and verify before the next consequential dependency advances. Combine units when splitting would require overlapping ownership or repeated negotiation of the same invariant.

Settle shared types, schemas, API contracts, and common primitives before dependent writers implement against them. A dependent unit becomes ready only after the required artifact is stable and available in its workspace. A completed report without an accessible result does not satisfy the dependency.

Parallelize ready units with independent inputs and disjoint writes. Also parallelize read-only investigations with distinct questions. Do not dispatch several agents to rediscover the same subsystem or write the same files. Compare competing designs with shared criteria, and select one owner before implementation.

Isolate concurrent writers with supported checkouts, worktrees, branches, or separate output directories. Account for shared ports, test databases, generated files, build directories, and caches as well as source files. Give shared changes an explicit integration owner. Bound concurrency by actual runtime capacity and resource use; no fixed number of workers is required.

## Plan and track actual progress

For a durable plan, follow repository conventions or the user's path, falling back to `docs/plans/<slug>.md`. Record the outcome, scope, unit dependency graph, parallel opportunities, ownership, integration order, acceptance evidence, unresolved risks, and authorization boundaries. A unit can be a local diff, commit, or PR; publication is not required.

Review the plan for missing outcomes, unfilled fields, dependency cycles, overlapping writes, and checks that cannot establish acceptance. If Node.js is available and the bundled template is used, the optional `scripts/check-plan.mjs` can check its structure. Structural success does not establish feasibility or correctness; perform the same review manually when the script is unavailable.

Use stable IDs such as U1 and U2 to connect the plan, task tracker, handoffs, and evidence. Use the current tool's real identifiers and status transitions. Preserve unrelated tasks. If no task tracker exists, maintain a checklist or status table with the same unit IDs.

Do not assume state is shared across sessions or that a tracker schedules work or enforces dependencies. The main agent reconciles the plan with actual running work, returned artifacts, and checks. Follow runtime limits on concurrent active tasks; represent parallel execution truthfully in the plan when the tracker cannot display it.

Dispatch each ready unit with its complete brief, including goal, workspace and base, inputs, write boundary, acceptance checks, report format, and stop conditions. Give each child a distinct bounded assignment. Choose available models according to user policy without hard-coding vendor aliases here.

Do useful independent work while children run, without overlapping their writes. Use supported completion notifications or status mechanisms. Treat launch, tool, and model failures as blockers to diagnose; do not silently switch execution modes or claim unavailable capabilities.

Accept a handoff only after inspecting its actual diff and evidence. Integrate verified independent units as they become ready, and release newly ready dependents. Keep implementation-ready, awaiting integration, blocked, and verified outcomes distinct. Mark a unit complete only when its acceptance and integration requirements are satisfied.

## Verify the result

- Every acceptance check names the input, procedure, pass condition, evidence destination, and revision or content identity. Include uncommitted changes when identifying what was tested.
- Use relevant tests for contracts and failure cases. Exercise the actual changed surface as well, such as a running API, CLI command, UI interaction, or configuration consumer. Documentation changes can be verified against the documented contract and references. A compile or structural check alone does not prove the requested behavior.
- Cover critical regression behavior against the recorded base when comparable. If the base lacks the feature, state that and verify the added behavior and the end state the user waits for. Do not invent baseline results.
- Measure performance when the change affects a relevant budget or makes a performance claim. Record the metric, workload, probe, baseline, and failure threshold. Compare equivalent workloads or use a justified absolute budget.
- An inapplicable unit or perf check needs a concrete reason. An applicable check that cannot run stays an open verification gap. Select scenarios by risk and actual capability rather than requiring a fixed number of lanes, screenshots, or cloud machines.
- Follow required repository and user review gates. Tie verdicts to the reviewed revision and context. The author's report, tests, and CI cannot replace required independent review.
- After integration, verify the combined behavior and critical boundaries between units. Passing each unit separately does not prove that their composition satisfies the user's goal.
- When relevant code, dependencies, or inputs change, invalidate affected evidence and rerun those checks. Preserve still-valid results with a reason. Reopen verification using the tracker's supported transitions or a new follow-up task, without erasing history.

## Audit, pause, and finish

At a handoff, integration, changed contract, blocker, or resume, inspect observable progress, dependencies, write ownership, and evidence. Update the plan and task tracker, then adjust the next ready units. Record consequential decisions and why they changed the approach.

On hold or cancellation, stop launching work, signal active writers through supported controls, and verify their state before replacing them or reusing their workspace. Record residual processes and unchecked work. On resume, reconcile actual workspace state and evidence before continuing.

Do not infer a timer, recurring audit, or background process from a written checklist. Use a scheduler only when it exists and its use is authorized. Report its actual state.

Finish only when the integrated result satisfies the user's acceptance criteria and required checks and reviews are complete. Report changed behavior, evidence, material deviations, and remaining limitations. A checked plan or green task list is not proof by itself. Publication, merge, deployment, and external communication remain subject to the user's authorization.
