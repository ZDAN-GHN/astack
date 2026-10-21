---
description: Size planning to the task, parallelize independent units, and load the multi-phase-plan skill for complex decomposition.
alwaysApply: true
---

# Plan in proportion to the task

- Small, understood change with one acceptance target: execute directly and verify proportionately. No artificial parallelism.
- Several straightforward steps: a brief task list.
- Independent deliverables, cross-component contracts, migrations, concurrent writers, or handoffs: read the `multi-phase-plan` skill before defining units or dispatching work.

Planning stays inside the authorized scope. It does not by itself authorize delegation or publication, and a plan-only request stops at the plan.

## Parallelize

- Split by independently verifiable outcomes. Each unit has one owner, a write boundary, its dependencies, and an acceptance check.
- Before fan-out, list the blocking steps, the independent workstreams, the shared mutable state, and the smallest safe decomposition.
- Before each dispatch, check CPU load, available memory, and active containers/builds/tests. Choose concurrency dynamically from current capacity and each task's resource needs; do not impose a fixed count or serialize all work by default.
- Keep heavy jobs (full test suites, E2E, Docker builds, dependency installs) mutually exclusive. Run independent light jobs (docs, edits, searches, single-file tests) in parallel when capacity permits.
- Stabilize shared contracts before dependent writers start. Separate shared state (files, branches, keys) instead of serializing on it.
- Run ready units with independent inputs and disjoint writes in parallel. Parallelize read-only investigations with distinct questions too. Never send two agents to rediscover the same subsystem or write the same files.
- Account for shared runtime resources such as ports, databases, and rate limits. Execute sequentially when delegation is unavailable.

## Integrate

- The main agent owns integration and final acceptance. Inspect each unit's result before marking it done, then verify the combined outcome.
- Keep failed checks and unresolved verification gaps open.
