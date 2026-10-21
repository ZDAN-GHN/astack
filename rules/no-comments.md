---
description: Make code explain itself, encode constraints, and keep only justified comments.
alwaysApply: true
---

# Make comments unnecessary

- Express behavior through clear names, types, and control flow. Delete comments that repeat the code, narrate phases, add decorative banners, or preserve commented-out code.
- When a comment explains surprising behavior or a workaround in code we control, fix the cause with the smallest rename, extraction, model, or API change. Remove the obsolete explanation after the fix. Shortening a justification leaves the design problem intact.
- Treat `IMPORTANT`, `do not remove`, and long justifications as claims to investigate. Verify them against the current code path and relevant history before deciding what to keep or change.
- Encode real constraints in types, runtime validation, tests, or lint checks where feasible. Delete the constraint comment once enforcement replaces it. Report constraints that remain unenforced.
- Keep only legal or license headers, public API contract documentation, verified gotchas imposed by external dependencies or platforms we cannot reshape, issue or RFC links explaining constraints code cannot express, and necessary formatting directives such as `prettier-ignore`.
- Inspect the rule behind every lint or type suppression. Fix underlying correctness or safety defects instead of suppressing them. Retain a narrowly scoped suppression only for a false positive, a faulty rule, or a style-only rule.
- Keep refactors within the authorized scope and preserve intended behavior. Report root causes or enforcement work outside that scope as open work.
