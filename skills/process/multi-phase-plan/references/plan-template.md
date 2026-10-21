# <Program> plan

<What changes, for whom, and which observable outcome finishes the work. Under ten lines.>

## How to read this

One box is one unit of work. Every box names the evidence that checks it. Check a box only when its evidence exists and applies to the current revision. The plan is the durable record of acceptance criteria and evidence; task tracking or a checklist displays execution state.

Execution follows the multi-phase planning skill. <Record the actual path to its bundled execution guidance, whether execution is authorized, the base revision, the integration owner, local diff or PR delivery, and any publication, merge, or deployment limits.>

A unit is complete only when its applicable unit, live, and perf checks have evidence and its integration check is satisfied. An N/A needs a concrete reason. A verification gap stays open.

## Outcome and constraints

- Outcome. <User-visible end state.>
- Acceptance. <Observable pass conditions.>
- Constraints. <Repository rules, compatibility, scope, and exclusions.>
- Verification tools. <Available commands and runtime drivers; unavailable tools and their alternatives.>
- Evidence locations. <Paths for logs, screenshots, measurements, and revision records.>

## Program checklist

### Prepare execution

- [ ] Confirm the outcome and existing execution authorization. Evidence in this plan's authorization note.
- [ ] Record the base revision and working-tree state without disturbing existing user work. Save the record to <path>.
- [ ] Create or reconcile tasks with stable unit IDs, owners, acceptance criteria, and evidence paths using the available tracker or checklist. Record any runtime ID mapping in the unit status table.

### Assign owners and dependencies

- [ ] <Name the independent units and dependent units, their branch or integration policy, and the shared-file integration owner. Record the assignment in this plan.>
- [ ] <Name the isolation needed for concurrent writers, or state that execution is sequential. Record checkout paths and base revisions.>

### Audit at boundaries

- [ ] At a unit handoff, integration, relevant patch change, blocker, or resume, inspect actual changes and evidence; reconcile task tracking and this plan. Record the outcome in the unit status table.
- [ ] On hold, stop new work and stop active writers where the available tools permit it. Record running work, residual processes, and unchecked evidence before resuming.

### Integrate and verify

- [ ] <Name the integration owner, authorization boundary, and checks for the combined behavior. Save final evidence to a concrete path.>

| Unit | Tracker ID | Owner | Revision | State | Evidence / blocker |
| --- | --- | --- | --- | --- | --- |
| U1 | unassigned | <owner> | unrecorded | planned | <evidence path> |

## <Task as a verb phrase> (U1)

**Owner.** <One responsible owner.>

**Depends on.** None.

**Inputs.** <Required contracts, base revision, files, and predecessor artifacts available before dispatch.>

**Files.**

- [ ] <Edit, create, or delete concrete paths or globs. Name any shared-file handoff. Check against the actual diff.>

**Build.**

- [ ] <One implementation step naming the file or symbol and the resulting artifact.>

**You see.**

- [ ] <Observable end state and where its evidence is saved.>

**Verify, unit.**

- [ ] <Relevant existing or new contract test, exact command, expected result, and saved output path.>

**Verify, live.**

- [ ] <Drive the actual changed surface with concrete input. State the pass predicate, evidence path, and recorded head revision.>
- [ ] <Exercise the critical regression at base and head, or record why the base has no comparable behavior. State the pass predicate and evidence path.>

**Verify, perf.**

- [ ] Metric. <Metric and workload measured at base and head.>
- [ ] Probe. <Exact command or procedure, repeat strategy, and saved measurement path.>
- [ ] Baseline. <How to measure and record the base value before comparing.>
- [ ] Rule. <Numeric failure threshold or justified absolute budget.>

**Review gate.** <Required review and artifacts, or None with a reason and the applicable authorization.>

**Integrate.**

- [ ] <Integration owner, target, prerequisites, authorization, and evidence of the integrated result. A required review or merge remains unchecked until it happens.>

**Handoff.**

- [ ] <Name the next consumer and deliver changed files, revision or diff identity, actual check results, artifact locations, and unresolved findings.>

## Close the program

- [ ] All units have valid evidence or explicit justified N/A blocks, satisfy acceptance and integration requirements, and have no unresolved verification gaps. Record the final revision and result in this plan.
- [ ] Run the plan's combined-behavior checks and save the final output at <path>.
- [ ] Reconcile task tracking and report the result, evidence, deviations, and remaining limitations to the user.

## Appendix A. Prototype evidence

<Questions investigated, commands, revisions when available, results, artifacts, and questions still unproven. Write None with a reason when no prototype is needed.>

## Appendix B. Alternatives rejected

<Consequential alternatives and why they lost, or None with a reason.>

## Appendix C. Risks

<Risks, affected units, concrete mitigation, and unresolved verification gaps.>

## Appendix D. Links and reading list

<Repository instructions, relevant docs, file pointers, and the actual paths of any optional skills used.>
