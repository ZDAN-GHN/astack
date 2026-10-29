# astack

My agent skill library. Each directory under `skills/` is one Agent Skill, copied byte for byte from an upstream source, adapted only where Pi needs it, and published by symlinking `~/.agents/skills` at the `skills/` folder itself.

## Layout

```
skills/<skill-name>/SKILL.md
```

Flat, one level, no category folders. [`skills/`](./skills) is the whole library, and this README is its only index. Adding a skill means adding a directory and one line here; there is no bucket to choose and no second index to keep in sync.

Supporting files (`references/`, `scripts/`, assets) sit beside `SKILL.md` inside the skill directory.

## Invocation

Every skill is one of two kinds:

- **User-invoked**: `disable-model-invocation: true` in the frontmatter, so only `/skill:<name>` reaches it. Its description is read by a human.
- **Model-invoked**: no such flag, so the model can also reach for it on its own. Its description carries trigger phrasing.

## User-invoked

- **[architect](./skills/architect/SKILL.md)**: Sketch types, signatures, and module structure before code, then stay in the loop while implementation fills in.
- **[arena](./skills/arena/SKILL.md)**: Run N parallel candidates at the same task, pick one as the base, graft the strongest parts of the others into it.
- **[book-to-skill](./skills/book-to-skill/SKILL.md)**: Convert a book or document into a structured agent skill holding its frameworks, mental models, and anti-patterns.
- **[correct](./skills/correct/SKILL.md)**: Find the mistakes agents keep repeating in this repo and make each one impossible.
- **[ds-prompting](./skills/ds-prompting/SKILL.md)**: DeepSeek 极限用量提示词的逐字存档，需要原样取用时调用。
- **[grill-me](./skills/grill-me/SKILL.md)**: Get relentlessly interviewed about a plan or design until every branch of the design tree is settled.
- **[grill-with-docs](./skills/grill-with-docs/SKILL.md)**: Grilling session that also builds the project's domain model, writing `GLOSSARY.md` and ADRs inline. Asks at most 3 questions per round.
- **[handoff](./skills/handoff/SKILL.md)**: Compact the current conversation into a handoff document another agent can pick up.
- **[how](./skills/how/SKILL.md)**: Walk the code before changing it; answer placement, ownership, and layering questions.
- **[in-your-own-words](./skills/in-your-own-words/SKILL.md)**: Restate your reading of the user's goals and the problem before working on it.
- **[interrogate](./skills/interrogate/SKILL.md)**: Adversarial review of a change by one reviewer per reachable model family, synthesized into a verdict.
- **[no-comments](./skills/no-comments/SKILL.md)**: Spawn the comment-sicko subagent, fix accepted findings, offer encodings for claimed constraints.
- **[readme-crafter-skill](./skills/readme-crafter-skill/SKILL.md)**: Write, rewrite, or audit a repository's `README.md` as a landing page and onboarding guide.
- **[retro](./skills/retro/SKILL.md)**: Retrospective on a coding session, most severe improvement first.
- **[sharpen](./skills/sharpen/SKILL.md)**: Make a task deeper rather than bigger, then rewrite the prompt to ask for that.
- **[statechart](./skills/statechart/SKILL.md)**: Draw what the user sees as a Mermaid statechart from a TLA+ model, with found bugs as numbered paths.
- **[teach](./skills/teach/SKILL.md)**: Explain a body of work plainly by running `/how` and `/why` and weaving both into one explanation.
- **[to-goal](./skills/to-goal/SKILL.md)**: Compile approved work and the current repo state into a copyable goal another session can execute and verify. Read-only.
- **[unslop](./skills/unslop/SKILL.md)**: Cut AI tells from any writing.
- **[video-transcribe](./skills/video-transcribe/SKILL.md)**: Bilibili 视频或本地音频转成带时间戳的中文转写，并按内容生成阅读报告或笔记。
- **[voice-debrief](./skills/voice-debrief/SKILL.md)**: 面试或会议录音转写复盘，可存飞书文档并归档到对应多维表格。
- **[wait-what](./skills/wait-what/SKILL.md)**: Stop the answer that did not land and re-pitch it: context first, Simplified Technical English, project glossary terms.
- **[why](./skills/why/SKILL.md)**: Answer "why does it work this way": design rationale, regressions, postmortems, data-backed thresholds.

## Model-invoked

- **[archify](./skills/archify/SKILL.md)**: Render architecture, workflow, sequence, ERD and lifecycle diagrams plus one-page explainers as standalone HTML through a JSON-IR CLI.
- **[code-review](./skills/code-review/SKILL.md)**: Review the diff since a fixed point on two axes, Standards and Spec, run as parallel sub-agents and reported side by side.
- **[codebase-design](./skills/codebase-design/SKILL.md)**: Shared vocabulary for deep modules: interface, seam, depth, adapter, plus deepening and design-it-twice passes.
- **[diagnosing-bugs](./skills/diagnosing-bugs/SKILL.md)**: Diagnosis loop for hard bugs and perf regressions, built on a tight pass/fail feedback loop.
- **[dispatching-parallel-agents](./skills/dispatching-parallel-agents/SKILL.md)**: Split independent work across agents dispatched in one response, then review and integrate what they return.
- **[domain-modeling](./skills/domain-modeling/SKILL.md)**: Build and sharpen the domain model: challenge terms, test edge-case scenarios, keep `GLOSSARY.md` and ADRs current.
- **[find-skills](./skills/find-skills/SKILL.md)**: Discover and install skills from the open agent skills ecosystem.
- **[grilling](./skills/grilling/SKILL.md)**: Interview the user relentlessly about a plan until every branch of the design tree is settled. The engine behind `/grill-me` and `/grill-with-docs`.
- **[pandoc-docx-template](./skills/pandoc-docx-template/SKILL.md)**: Markdown to DOCX (and back) with Pandoc, using the bundled Chinese Word templates and Lua filters.
- **[prototype](./skills/prototype/SKILL.md)**: Build a throwaway prototype to answer a design question: one shareable HTML file for a state model, or several switchable UI variations on one route.
- **[reticle](./skills/reticle/SKILL.md)**: Verify a change inside the running web app: a verdict with the request and state that decided it, plus the `file:line` to fix.
- **[show-me](./skills/show-me/SKILL.md)**: Explain the current topic visually with diagrams, code-shape sketches, and focused HTML artifacts.
- **[ui-ux-pro-max](./skills/ui-ux-pro-max/SKILL.md)**: Design intelligence for web, mobile, and desktop interfaces: styles, palettes, font pairings, UX guidelines, charts, and stack-specific implementation.
- **[verification-before-completion](./skills/verification-before-completion/SKILL.md)**: Put every completion claim behind fresh evidence: run the check, read the output, then report.
- **[writing-for-agents](./skills/writing-for-agents/SKILL.md)**: The levers for writing anything an agent consumes: context pointers, skills, `AGENTS.md`, and pointer wording.

## Install

`~/.agents/skills` is one symlink to this repo's `skills/` folder, so every skill here is a skill Pi can load and `git pull` keeps them current:

```bash
node scripts/link-skills.mjs          # point ~/.agents/skills at skills/, replacing the old per-skill links
node scripts/link-skills.mjs --check  # report a wrong or missing link
```

Then run `/reload` in Pi. Conventions for installing, adapting, and indexing skills live in [`AGENTS.md`](./AGENTS.md).
