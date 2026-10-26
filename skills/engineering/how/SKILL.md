---
name: how
description: "Use for \"how does X work\", code walkthroughs before changing something, and placement / ownership / layering questions (\"where should this live\", \"which package owns this\", \"is this the right layer\"). Explains subsystem architecture, runtime flow, onboarding mental models. Use why for motivation."
disable-model-invocation: true
---

# How

Explore the codebase to answer "how does X work?" questions. Produce architectural explanations at the level of a senior engineer onboarding onto a subsystem, enough to build a working mental model, not so much that it reads like annotated source code.

Every spawn below names a seat. Resolve it per [Seats](#seats).

## Step 1. Assess Complexity

If the scope is ambiguous, state your interpretation and explore. The user can redirect.

- **Simple** (a single module, a small utility, a narrow question such as "how does function X work"): no explorers. One explainer explores and explains in a single pass. Go to Step 2b.
- **Complex** (a subsystem spanning multiple files or services, a cross-cutting feature, a full architectural overview): spawn parallel explorers first, then hand off to the explainer. Go to Step 2a.

When in doubt, take the simple path.

## Step 2a. Explore (complex questions only)

Decompose the question into 2 to 4 exploration angles, each a distinct slice of the subsystem. Spawn all explorers in a single message, each read-only, on the `explorer` seat.

Each explorer gets the prompt in `references/explorer-prompt.md` with its angle filled in. Then go to Step 3.

## Step 2b. Direct Explain (simple questions)

Spawn one read-only subagent on the `explainer` seat that explores and explains in one pass.

Build its prompt from `references/explainer-prompt.md` without the explorer-findings section. Go to Step 4.

## Step 3. Synthesize (complex questions only)

Once all explorers have returned, spawn one read-only subagent on the `explainer` seat to synthesize their findings into one explanation.

Build its prompt from `references/explainer-prompt.md` with every explorer's findings filled in.

## Step 4. Present

Present the explainer's output to the user. Light edits for clarity or context from the conversation are fine. Do not substantially rewrite it.

## Output Format

The explanation uses the sections defined in `references/explainer-prompt.md`, dropping any that do not apply: Overview, Key Concepts, How It Works, Where Things Live, Gotchas.

## Seats

A seat is a capability profile plus a reasoning effort, never a model name. Resolve each seat in this order:

1. Use your environment's own role-to-model mapping when it has one for that seat. Its file, variable, or setting name is specific to that runtime, so don't assume a path.
2. Otherwise leave the model unset so the harness picks, and set only the reasoning effort.
3. When you must choose a model by hand, match the profile, then say which seat ran on what. If nothing available fits, say so instead of quietly substituting.

Effort, weakest to strongest: `minimal`, `low`, `medium`, `high`, `max`. Use the closest level your runtime offers, and leave effort unset to inherit the parent's.

| Seat | Profile | Effort |
| --- | --- | --- |
| explorer | Fast and cheap across many files. Reports what the code does with paths and line references, and resists filling gaps with guesses. | low |
| explainer | Strong synthesis and plain prose for a senior-engineer reader. Turns findings into a mental model rather than a file tour. | high |
