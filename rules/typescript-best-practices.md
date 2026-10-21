---
description: Core TypeScript constraints; load the typescript-best-practices skill for detailed modeling, boundary validation, and examples.
paths: ["**/*.ts", "**/*.tsx"]
alwaysApply: false
---

# TypeScript core constraints

- Model variants with discriminated unions and exhaustive handling. Avoid optional-field bags; encode illegal states out of existence. Keep the simplest total type, strengthening it when operations would otherwise need assertions or impossible-state throws.
- Brand domain primitives that must not mix. Treat external data as `unknown`; validate once at the boundary into a named domain type, then trust types inside. Raw unknown records stop at the parse.
- Use the repository's runtime schema library before hand-written property guards; infer types from schemas. Guards must verify their claims. Prefer discriminants and compiler narrowing, then validated guards; cast only after validation. Use `satisfies` to check values without widening literals.
- Derive types from existing schemas and values before declaring parallel interfaces. Prefer object arguments, except on hot paths.
- Test real behavior using available framework primitives; mock only what cannot run locally. Use structured diagnostics with debugging context; no shipped `console.log`.

For detailed modeling, boundary design, assertion fixes, or examples, read the installed `typescript-best-practices/SKILL.md` and follow its linked principles and patterns. The repository entry is [typescript-best-practices/SKILL.md](../../skills/engineering/typescript-best-practices/SKILL.md). Resolve this link from the rule's real directory when reached through a symlink; when installed separately, locate the skill by name in the host's skill directory.
