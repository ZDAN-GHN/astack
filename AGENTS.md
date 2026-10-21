# Agent Instructions

This repo is a skill library, not a project to build or test. Each directory under `skills/` is one Agent Skill, copied from an upstream source and published to `~/.agents/skills/` by symlink.

## Layout

| Item | Rule |
|---|---|
| Skill | `skills/<category>/<skill-name>/SKILL.md` |
| Category | Reuse an existing directory: `design` `education` `engineering` `process` `productivity` `tools` |
| New category | Only when no existing one fits; lowercase, single word |
| Supporting files | `references/`, `scripts/`, and assets stay beside `SKILL.md` |
| Frontmatter | `name` must equal the skill directory name |

## Install a skill

1. Pin the upstream source to a revision (commit SHA or tag). Copy from upstream itself, never from a translation, port, or another agent's vendored copy.
2. Copy the skill directory into the chosen category, byte for byte, then confirm with `diff -r` against the source. Retyping upstream prose is a defect even when it looks equivalent.
3. Compare frontmatter field by field against upstream, not only the body. Keep `disable-model-invocation: true` when upstream has it.
4. Adapt only what cannot work on Pi, using `apply_patch`. That means platform paths (`.cursor/skills/` becomes `.agents/skills/`), other agents' config paths, and vendor-specific tool names. Everything else stays as upstream wrote it.
5. Re-run `diff -r` against the source and state every changed line.
6. Link it and verify the link resolves:

   ```bash
   ln -s /home/zdan/github/astack/skills/<category>/<name> /home/zdan/.agents/skills/<name>
   readlink /home/zdan/.agents/skills/<name>
   grep -c '^disable-model-invocation: true$' /home/zdan/.agents/skills/<name>/SKILL.md
   ```

7. Report the source and revision, and any reference the copy left dangling (a playbook, skill, or path that does not exist here).

The user runs `/reload` in Pi after a skill or its frontmatter changes.

## Facts

- `~/.agents/skills/` is Pi's user skill directory. Every entry in it is a symlink to a directory in this repo, one entry per skill.
- Categorize by what the skill does, not by who published it.
- `global-agents-principle.md` at the repo root is the global principles asset, distributed to `~/.agents/AGENTS.md`, which Pi loads across every working directory. It is not this repo's own instruction file.

## Don't

- Do not reword, shorten, or otherwise improve copied upstream text. Report the problem instead.
- Do not install with `npx skills add`: it writes into an agent's skill directory with no category and no link.
- Do not put a real directory under `~/.agents/skills/`. That entry is a symlink, and a copy there breaks updates.
