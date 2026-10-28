# Process

How a session runs: interviews, handoffs, retrospectives, working notes.

Every user-invoked skill here is reachable only when you type it: `/skill:<name>`.

## User-invoked

- **[bro](./bro/SKILL.md)**: Restate the last message in plain human language, with no jargon.
- **[grill-me](./grill-me/SKILL.md)**: Get relentlessly interviewed about a plan or design until every branch of the design tree is settled. Same engine as `grill-with-docs`, without the docs.
- **[handoff](./handoff/SKILL.md)**: Compact the current conversation into a handoff document another agent can pick up.
- **[in-your-own-words](./in-your-own-words/SKILL.md)**: Restate your reading of the user's goals and the problem before working on it.
- **[retro](./retro/SKILL.md)**: Retrospective on a coding session, most severe improvement first.
- **[sharpen](./sharpen/SKILL.md)**: Make a task deeper rather than bigger, then rewrite the prompt to ask for that.
- **[show-me-your-work](./show-me-your-work/SKILL.md)**: Keep a reviewable decision trail for long-running or unattended work, one TSV row per decision.
- **[statechart](./statechart/SKILL.md)**: Draw what the user sees as a Mermaid statechart from a TLA+ model, with found bugs as numbered paths.

## Model-invoked

Model- or user-reachable, so a rich trigger description pays off.

- **[agents-md](./agents-md/SKILL.md)**: Create and maintain concise `AGENTS.md` / `CLAUDE.md` project instruction files.
- **[grilling](./grilling/SKILL.md)**: Interview the user relentlessly about a plan until every branch of the design tree is settled. The engine behind `grill-with-docs`.
