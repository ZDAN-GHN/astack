---
name: interrogate
description: "Use for \"interrogate\", \"adversarial review\", \"multi-model review\", \"challenge this\", \"stress test this code\", \"find blind spots\", or \"tear this apart\". Multiple LLM reviewers challenge changes from independent angles."
disable-model-invocation: true
---

# Interrogate

Spawn one reviewer per distinct model family you can reach, to adversarially review code changes. The adversarial signal comes from model diversity, not assigned personas. The deliverable is a synthesized verdict. Do NOT auto-apply changes.

## Step 1, Scope

Identify what to review from context:

- If the user points at specific files or a diff, use that.
- If on a feature branch, run `git diff main...HEAD` (or the appropriate base branch) for the full changeset.
- If the user's message references recent work, gather the relevant files.

Package the diff or file contents with any surrounding context files the reviewers need to understand the code.

## Step 2, Intent

Before spawning reviewers, state the intent in one clear paragraph from the user's message, commit messages, the PR description if one exists, and the code. If you're unsure about the intent, ask the user before proceeding.

## Step 3, Spawn Reviewers

Launch all reviewers in a single message with your subagent tool, labeled Reviewer A, B, and so on. Spread them across model families, because the adversarial signal comes from diversity rather than from assigned personas.

Read `references/reviewer-prompt.md` and fill in the same template for every reviewer with the stated intent, the diff or file contents, the rubric from `references/rubric.md`, and the code-quality lens from `references/code-quality-review.md`. Every reviewer runs read-only, on a seat resolved per [Seats](#seats).

## Step 4, Synthesize

As results come back, build a unified picture. Parse every reviewer's findings. Merge findings that describe the same issue differently, and note which models raised each one. Findings two or more models raised independently are the highest signal. Read a lone model's finding, but weight it accordingly. Note disagreements. If one model flags something and another explicitly says the opposite, that is context for the verdict.

## Step 5, Lead Judgment

You are the lead reviewer, a pragmatic senior engineer, not a neutral aggregator. Read `references/lead-judgment.md` for the full framework. Put every finding in one of four buckets, with the model(s) that raised it and a one-line rationale.

- **Act on**. Real issues affecting correctness, security, or maintainability given the actual goals. They would block a real PR.
- **Consider**. Legitimate, but you're not sure they outweigh the cost of addressing them now. Worth the user's attention.
- **Noted**. Technically valid but not actionable. Context-dependent, premature optimization, or low-impact at this stage.
- **Dismissed**. Wrong, nitpicky, or missing context, with a brief reason.

## Seats

A seat is a capability profile plus a reasoning effort, never a model name. Resolve each seat in this order:

1. Use your environment's own role-to-model mapping when it has one for that seat. Its file, variable, or setting name is specific to that runtime, so don't assume a path.
2. Otherwise leave the model unset so the harness picks, and set only the reasoning effort. A seat that runs on the parent model is fine, as long as the reviewer set as a whole still spans families.
3. When you must choose a model by hand, match the profile, then say which seat ran on what. If nothing available fits, say so instead of quietly substituting.

Effort, weakest to strongest: `minimal`, `low`, `medium`, `high`, `max`. Use the closest level your runtime offers, and leave effort unset to inherit the parent's.

| Seat | Profile | Effort |
| --- | --- | --- |
| reviewer | Strong adversarial reading of unfamiliar code. Names a concrete failure it can point at, and reports "nothing found" rather than inventing severity. Each reviewer comes from a different family than the others where the runtime allows it. | high |

## Output Format

### Intent
> [The stated intent paragraph from Step 2]

### Reviewers
- Reviewer [label]: [model name], [N findings] (one bullet per reviewer)

### Act On
[Each: description, which models raised it, why it matters.]

### Consider
[Each: description, which models raised it, the tradeoff.]

### Noted
[Brief list.]

### Dismissed
[Each with a brief rationale.]

### Agreement Map
[Where models agreed and diverged, and what that pattern tells us.]
