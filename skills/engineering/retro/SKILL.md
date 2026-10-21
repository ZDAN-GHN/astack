---
name: retro
description: "Conduct a retrospective on a coding session."
disable-model-invocation: true
---

The user has asked for a **retrospective**. You are suggesting improvements to the coding agent's **environment** to improve future runs.

## Steps

1. Use the writing guidance below when presenting findings or proposing instruction changes.

2. Read the primary sources for the session the user specifies. This may mean searching through session logs on this machine. If the user doesn't specify a session, default to the current one.

3. Look for candidates for improvement in these categories.

- **Navigation**: how easy was it for the agent to find the right files? Are there hidden dependencies between files? Would a **navigation pointer** make it easier? _Use when_ the session took a long time to find a piece of information.
- **Automated checks**: are there automated checks that could catch errors the agent made? Linting, typing, tests, filesystem linters? Read the repo's own check command first (its `package.json`/build-tool `lint`/`check` scripts, its CI workflow), so a check that already exists but sits unwired or silently broken is the finding, not a reinvention. A repo with no **guardrail** (no pre-commit hook and no CI job running its lint/typecheck/test command) is itself a finding: an un-linted repo is a standing missed opportunity, not a neutral default. _Use when_ the agent made a mistake an automated check could have caught, or the repo has no guardrail at all.
- **Coding standards**: should review guidance gain a rule, or should an existing rule be removed or clarified? Classify the violation first: a **mechanical** one (a fixed syntactic pattern, a banned API, an import shape, a file-location rule) gets a deterministic check, full stop: a custom rule in the repo's own linter, a new pre-commit hook, or a new CI job, whichever the repo's language and existing guardrail make cheapest. Default to building the check over writing the rule. Reserve the repo's review or standards document for genuine **judgement calls** (cross-file consistency, "matches the surrounding style," anything no guardrail could ever substitute for). _Use when_ a coding standard was unclear or a review missed a mistake.
- **Global AGENTS.md**: are there any steering instructions that should be moved to coding standards (or automated checks) instead? _Use when_ the AGENTS.md file is particularly large - in the repo OR the user's global scope.
- **Tool economy**: did the agent make expensive tool calls that could be streamlined? Is there any custom tooling (CLI's, MCP's) that is particularly token-inefficient? _Use when_ the agent made an expensive tool call.
- **No-ops**: look for instructions in steering files that don't modify the agent's behavior. _Use when_ the steering files are large and unwieldy.
- **Information access**: look for opportunities to increase the agent's access to information. Teeing dev server logs, readonly access to third-party services. _Use when_ a crucial piece of information was not available to the agent.

4. Present these candidates to the user, in order of severity. For each candidate, cite session evidence, explain the impact, and propose the smallest environment change that addresses it. State any evidence gaps.

## Reference

### Writing guidance

- Write concise, actionable instructions. Each instruction should change behavior.
- Separate ordered steps from reference material. Give each step a checkable completion criterion.
- Keep each rule in one authoritative place. Inspect existing docs, scripts, and configuration before proposing another copy.
- Use precise reference paths and state when to read them. Inline guidance needed on every run; link optional detail.
- Phrase instructions as the desired behavior. Reserve prohibitions for hard constraints.

### Implementation and review

When the workflow has separate implementation and review agents, put judgement-based coding standards in review guidance to reduce the implementation agent's context load. In a single-agent workflow, apply those standards during self-review.

### Files

Inspect the files that exist in the target environment:

- `CLAUDE.md`/`AGENTS.md`: these files are pushed to the context window of agents that support them. They should be used sparingly, usually only for **navigation pointers** to other files.
- Review or standards docs, such as `CODING_STANDARDS.md`: keep judgement-based rules here. Add **navigation pointers** to docs folders if the standards file gets more than 1,000 lines long.
- Docs: use docs as reference files, pointed to by other files. Look for existing docs before writing new ones.
- Skills, when supported: use them for reusable task guidance or user-invoked commands. Apply the writing guidance above.
