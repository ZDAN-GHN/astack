# Execute a multi-phase plan

Read the plan, repository instructions, available tools, current working-tree state, and existing task list. Confirm the execution authorization recorded in the conversation. Continue authorized work without requesting the same permission again. If the user requested planning only, deliver the plan and wait for an instruction to execute.

## Reconcile the plan and task tracking

The plan is the durable record of unit IDs, dependencies, acceptance criteria, revisions, and evidence. A task tracker or checklist displays execution state. Inspect the current runtime's persistence and sharing behavior. Do not assume a child can update the parent's list or that state survives a new session. Reconstruct missing tasks from the plan and actual evidence.

List before creating. Preserve unrelated tasks; never clear the user's whole list. Create one task per unit, plus integration and verification tasks when they have independent acceptance criteria. Use the subject `[U1] <verb phrase>`, and put the owner, file boundary, acceptance criteria, commands, and evidence locations in its description.

Record prerequisites using stable unit IDs and, when supported, the tracker's actual dependency identifiers. Verify the graph has no cycles and check prerequisite completion before dispatch. If a unit needs an integrated predecessor result, depend on the integration task rather than merely on an implementation report.

For example, U1 establishes an API contract. Once that contract is verified and available to both workspaces, U2 implements the server and U3 implements its client in disjoint files. U4 integrates both results and checks the complete request flow. U2 and U3 may run together; U4 waits for both. If U2 changes the contract, reassess U3 before proceeding.

Use task statuses and concurrency displays that the available tracker supports. If it permits only one active parent task, track supervision there and record child progress in the plan. If it supports parallel active rows, display them directly. With no tracker, update the plan's status table. Keep running work, blocked work, implementation-ready artifacts, integration, and accepted completion distinguishable.

Each child result must pass the main agent's acceptance review before the unit is completed. Complete tasks when their evidence is accepted, not in a batch. A failed test, missing applicable runtime check, required review, or unresolved integration keeps the unit open.

When later changes invalidate completed evidence, use a supported reopening operation or create a follow-up verification task. Retain historic results and record why they became stale. Do not erase completed work merely to bypass the tracker's status rules.

## Execute verifiable units

1. Pick a ready unit with satisfied dependencies. Inspect its files and assumptions before editing. Update the plan when evidence changes the approach.
2. Delegate only with available tools and bounded ownership. Give the child the unit's outcome, allowed files, base, dependencies, checks, and report format. Use configured model policy. When no subagent tool is available, execute the same units sequentially.
3. Isolate concurrent writers when needed, using the runtime's available checkouts, branches, worktrees, or separate output directories according to repository conventions. Record each workspace, base, and integration owner. Assign shared ports, databases, generated files, and build directories explicitly. Two writers must not mutate the same shared resource at once.
4. Implement the smallest change that satisfies the unit. Add tests only when they cover a meaningful contract or risk. Run required repository checks and the plan's concrete real-surface scenarios. Measure perf when the plan requires it.
5. Record actual commands, outcomes, artifacts, and revision or content identity. A SHA alone does not identify uncommitted changes; record the diff or its identity with the results. Do not substitute an owner's summary for the evidence it claims.
6. Inspect the diff and receipts against the unit's acceptance criteria. Resolve defects before accepting. If relevant code or test inputs change, repeat affected checks; retain still-valid evidence with an explanation instead of rerunning unrelated suites.
7. Integrate under the recorded policy and existing authorization. Inspect combined behavior after integrating dependent or parallel work. Do not publish, merge, or deploy unless the user has authorized that action.
8. Update checkboxes and task tracking only after all applicable evidence and integration requirements are satisfied. Report a unit as implementation-ready when required review or integration is still pending, and keep its completion checkbox open.

## Audit, pause, and resume

Audit at unit handoffs, integration, relevant patch changes, blockers, and resume. Compare observable changes and evidence with the plan, then reconcile the status table and task tracking. A running process or an agent's assurance is not proof of progress.

Do not assume task tracking schedules recurring audits. If an available scheduler is explicitly requested, configure it and report its actual state. Otherwise use the event boundaries above; never claim an hourly audit is armed.

If the user holds or stops the work, stop launching units and signal active writers with available controls. Record any processes or writers that could not be stopped. Resume only under the user's instruction after checking the current worktree, active work, and evidence validity.

Keep a failed unit open and create a blocker task when useful. State the failure, the affected outcome, and the evidence needed to unblock it. Do not mark an unavailable runtime check as N/A merely to finish the list.

## Finish

Exercise the integrated result against the plan's user-visible acceptance criteria. Run only the relevant remaining checks, save the final evidence, and reconcile the plan and task tracking.

Report what the user can now do, changed behavior, checks actually performed, and any material limitations. If acceptance or a required review remains open, report the work as incomplete. A checked plan, a green task list, and a successful structural checker do not by themselves prove the software works.
