# Engineering

Daily code work: design, diagnosis, review.

Every user-invoked skill here is reachable only when you type it: `/skill:<name>`.

## User-invoked

- **[architect](./architect/SKILL.md)**: Sketch types, signatures, and module structure before code, then stay in the loop while implementation fills in.
- **[arena](./arena/SKILL.md)**: Run N parallel candidates at the same task, pick one as the base, graft the strongest parts of the others into it.
- **[correct](./correct/SKILL.md)**: Find the mistakes agents keep repeating in this repo and make each one impossible.
- **[create-verification-skill](./create-verification-skill/SKILL.md)**: Generate a project-local skill that drives the app the way a user does and captures evidence.
- **[grill-with-docs](./grill-with-docs/SKILL.md)**: Grilling session that also builds the project's domain model, writing `GLOSSARY.md` and ADRs inline. Asks at most 3 questions per round.
- **[how](./how/SKILL.md)**: Walk the code before changing it; answer placement, ownership, and layering questions.
- **[interrogate](./interrogate/SKILL.md)**: Adversarial review of a change by one reviewer per reachable model family, synthesized into a verdict.
- **[maintain-verification-skill](./maintain-verification-skill/SKILL.md)**: Periodic pass that keeps a project's verification skill and feature map honest.
- **[no-comments](./no-comments/SKILL.md)**: Spawn the comment-sicko subagent, fix accepted findings, offer encodings for claimed constraints.
- **[why](./why/SKILL.md)**: Answer "why does it work this way": design rationale, regressions, postmortems, data-backed thresholds.

## Model-invoked

Model- or user-reachable, so a rich trigger description pays off.

- **[clean-code-reviewer](./clean-code-reviewer/SKILL.md)**: Review code against the Clean Code principles, with before/after examples per finding.
- **[domain-modeling](./domain-modeling/SKILL.md)**: Build and sharpen the domain model: challenge terms, test edge-case scenarios, keep `GLOSSARY.md` and ADRs current.
- **[last30days](./last30days/SKILL.md)**: What people actually said about a topic in the last 30 days, across Reddit, X, YouTube, Hacker News, Polymarket, and GitHub.
- **[prototype](./prototype/SKILL.md)**: Build a throwaway prototype to answer a design question: one shareable HTML file for a state model, or several switchable UI variations on one route.
