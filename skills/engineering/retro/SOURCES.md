# Sources

`retro` is a user-requested standalone adaptation of [mattpocock/skills](https://github.com/mattpocock/skills/tree/49dd158d1076134a641b33efb035946536778336/skills/engineering/retro), pinned to commit `49dd158d1076134a641b33efb035946536778336`.

The inline writing guidance is distilled from [`writing-for-agents`](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/productivity/writing-for-agents/SKILL.md) at the same revision. These links record provenance; neither source is required to run this skill.

Changes from the pinned upstream:

- Replace the required `writing-for-agents` invocation and closing reference with inline writing guidance.
- Require evidence, impact, a concrete proposed change, and any evidence gaps for each finding.
- Support both separate implementation/review agents and a single agent performing self-review, subject to the target environment's review requirements.
- Treat instruction files, standards docs, and skill support as environment-dependent rather than prerequisites.

The original frontmatter, seven improvement categories, and `agents/openai.yaml` are preserved.
