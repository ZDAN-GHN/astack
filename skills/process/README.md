# Process

How a session runs: interviews, handoffs, retrospectives, working notes.

Every user-invoked skill here is reachable only when you type it: `/skill:<name>`.

## User-invoked

- **[grill-me](./grill-me/SKILL.md)**: Get relentlessly interviewed about a plan or design until every branch of the design tree is settled. Same engine as `grill-with-docs`, without the docs.
- **[handoff](./handoff/SKILL.md)**: Compact the current conversation into a handoff document another agent can pick up.
- **[in-your-own-words](./in-your-own-words/SKILL.md)**: Restate your reading of the user's goals and the problem before working on it.
- **[retro](./retro/SKILL.md)**: Retrospective on a coding session, most severe improvement first.
- **[sharpen](./sharpen/SKILL.md)**: Make a task deeper rather than bigger, then rewrite the prompt to ask for that.
- **[statechart](./statechart/SKILL.md)**: Draw what the user sees as a Mermaid statechart from a TLA+ model, with found bugs as numbered paths.
- **[to-goal](./to-goal/SKILL.md)**: Compile approved work and the current repo state into a copyable goal another session can execute and verify. Read-only; it never implements or edits anything.
- **[wait-what](./wait-what/SKILL.md)**: Stop the answer that did not land and re-pitch it: context first, Simplified Technical English, project glossary terms.

## Model-invoked

Model- or user-reachable, so a rich trigger description pays off.

- **[grilling](./grilling/SKILL.md)**: Interview the user relentlessly about a plan until every branch of the design tree is settled. The engine behind `grill-with-docs`.
- **[writing-for-agents](./writing-for-agents/SKILL.md)**: The levers for writing anything an agent consumes: context pointers, skills, `AGENTS.md`, and pointer wording.
