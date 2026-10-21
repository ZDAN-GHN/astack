---
description: Prevent repeated mistakes with enforceable checks and keep tests that detect real behavior failures.
alwaysApply: true
---

# Prevent repeat mistakes and test behavior

- When a mistake recurs or the user corrects you, address the mistake class at the highest practical level. Prefer architecture and ownership, then types, then deterministic lint or CI checks, then behavior tests. Reserve docs and agent instructions for judgement calls that mechanisms cannot enforce.
- For mechanical violations, reuse the repository's checks or add a deterministic guard. Its error should name the correct API, type, or pattern. Prove it rejects a real offending case and accepts the fix; use the same check command locally and in CI.
- Keep a test only if it detects broken promised behavior and survives internal refactoring that preserves that behavior. Rewrite or delete tests that fail either criterion.
- Exercise real code through its consumers' interface, or enforce a real invariant. Derive expected results from the requirement independently of the implementation. Assert observable outputs, errors, state, and external effects.
- Remove tests that merely repeat constants or prompt strings without exercising their contract, assert fixtures or mock setup the test created itself, or compute the expected answer with the code under test. A documented default or public invariant is a valid contract to test.
- Match verification to risk and reuse the smallest suitable harness. When a useful new test needs disproportionate infrastructure or brittle mocks, use the closest meaningful executable or manual check and state the verification gap. A test earns its place by the defect it would catch.
- For regression tests, confirm failure for the intended reason before the fix and success afterward. Change assertions when the contract actually changes; preserve meaningful checks when fixing an implementation defect.
