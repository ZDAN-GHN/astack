# Sources and conditional rule split

The upstream source is [cursor/plugins pstack](https://github.com/cursor/plugins/tree/ea32d9562a1c9f077d7cdd3be53d07383eb18866/pstack), pinned to commit `ea32d9562a1c9f077d7cdd3be53d07383eb18866`.

`SKILL.md` originates from `pstack/skills/typescript-best-practices/SKILL.md`, and `references/patterns.md` from its references directory. The three bundled principle documents originate from `pstack/skills/principle-type-system-discipline/SKILL.md`, `pstack/skills/principle-boundary-discipline/SKILL.md`, and `pstack/skills/principle-encode-lessons-in-structure/SKILL.md`. `LICENSE` is copied byte for byte from `pstack/LICENSE` at that revision.

These files were moved from `rules/typescript-best-practices/`. The [companion rule](../../../rules/typescript-best-practices/typescript-best-practices.md) keeps short constraints for TS/TSX work and directs the agent here when detailed modeling or boundary guidance is needed. The full table, principles, and examples have one source in this skill.

The entry's upstream frontmatter is restored field for field: `name`, `description`, `paths`, and `disable-model-invocation: true`. All three principle documents also retain their upstream frontmatter unchanged. In Pi, the disabled skill is omitted from automatic model discovery; the conditional rule explicitly directs the agent to read its installed `SKILL.md`, and it remains available as an explicit skill command. Other hosts must use their supported conditional-rule and skill-loading mechanisms.

Changes from the pinned upstream are limited to reference resolution:

- `SKILL.md`, lines 10 and 25: replace the standalone type-system-discipline skill invocation with a relative link, resolve references from the skill directory, and identify bundled principles as reference documents; replace the boundary-discipline skill invocation in the table with a relative link. No table constraints or examples are rewritten.
- `references/patterns.md`, lines 3 and 272: its opening uses `../SKILL.md` rather than `SKILL.md` and links the two bundled principles; the boundary-validation paragraph links the bundled boundary principle.
- `references/principle-type-system-discipline/SKILL.md`, lines 9, 14, and 17: link TypeScript guidance at `../../SKILL.md`, boundary guidance at `../principle-boundary-discipline/SKILL.md`, and lessons at `../principle-encode-lessons-in-structure/SKILL.md` instead of invoking standalone skills.
- `references/principle-boundary-discipline/SKILL.md`, `references/principle-encode-lessons-in-structure/SKILL.md`, and `LICENSE`: zero changed lines.

`SOURCES.md` and the companion rule are local integration documents. No standalone principle-skill installation is required. Resolve repository links from the real file location when a rule is reached through a symlink; if installed separately, locate this skill by name in the host's skill directory.
