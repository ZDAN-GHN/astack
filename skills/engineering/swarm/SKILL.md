---
name: swarm
description: "Fan out N parallel workers, drain them, and return one report. Use for /swarm, 'swarm this', or parallel coverage, races, gauntlets, and exploration."
disable-model-invocation: true
---

# Swarm

## Start

Open a todolist with one entry per phase before launching anything.

1. Frame
2. Fan out
3. Aggregate
4. Report

## Phase A: Frame

1. State the done predicate and the artifact or report the swarm must return.
2. Choose the shape. Partition into slices, race N workers on identical briefs, or mix both. For a race or mixed shape, declare `first pass`, `rank all`, or `best-of` before spawning.
3. Reserve one `worker` seat per worker from [Seats](#seats). For a model race, say which seat each arm runs on before spawning, so the arms stay distinguishable in the report.
4. Give each worker its own writable output when it writes. When workers verify or measure commits, each brief names the exact SHAs. A measurement brief also names the method (sample count, what one sample is, order). The worker records both in its result.

## Phase B: Fan out

Spawn all N workers in one message as background subagents, on the seat from step 3. Prefer an isolated environment when your harness offers one. Use the local environment only when the worker needs access to something on the user's computer.

When a worker must start from a non-default pushed branch, name that base branch in its brief.

Every brief stands alone. Include the goal, scope, exact slice or race arm, how to verify, and what to report. Reports use `PASS`, `ISSUES`, or `BLOCKED` with evidence. A worker that can prove a defect reports `ISSUES` and lists every issue it can prove, not only the first.

If a worker drops out, proceed with N-1 and note it.

## Phase C: Aggregate

Read the terminal results. Drop a result that does not record the SHAs and method its brief names, and respawn that worker once. After a second miss, record a gap. A gap does not count as a pass. For coverage, every required slice needs a result. For a race, apply the selection rule declared up front. Use first pass, rank all, or best-of. Do not paste raw worker dumps.

## Seats

A seat is a capability profile plus a reasoning effort, never a model name. Resolve each seat in this order:

1. Use your environment's own role-to-model mapping when it has one for that seat. Its file, variable, or setting name is specific to that runtime, so don't assume a path.
2. Otherwise leave the model unset so the harness picks, and set only the reasoning effort.
3. When you must choose a model by hand, match the profile, then say which seat ran on what. If nothing available fits, say so instead of quietly substituting.

Effort, weakest to strongest: `minimal`, `low`, `medium`, `high`, `max`. Use the closest level your runtime offers, and leave effort unset to inherit the parent's.

| Seat | Profile | Effort |
| --- | --- | --- |
| worker | Executes one self-contained brief without needing the conversation around it. Follows the brief's verification and reporting format exactly, and cheap enough to fan out wide. Prefer a faster variant when the brief is mechanical, a stronger one when it must judge. | medium |

## Phase D: Report

Return one consolidated in-chat report with the table, issue one-liners, gaps or dropouts, and the race rule when used.
