# Agent Instructions

This repo is a skill library, not a project to build or test. Each directory under `skills/` is one Agent Skill, copied from an upstream source and published by symlinking `~/.agents/skills` at the `skills/` folder itself.

## Layout

| Item | Rule |
|---|---|
| Skill | `skills/<skill-name>/SKILL.md` |
| Categories | None. `skills/` is flat: no bucket, no lifecycle folder, no nesting |
| Root index | `README.md` lists every skill, grouped as user-invoked and model-invoked. It is the only index |
| Supporting files | `references/`, `scripts/`, and assets stay beside `SKILL.md` |
| Frontmatter | `name` must equal the skill directory name |

Categories were removed on purpose. Five buckets (`design`, `education`, `engineering`, `process`, `tools`) mixed four different axes in one layer (domain, subject, session stage, implementation medium), left two of them holding a single skill, and made every addition a five-way guess. The upstream libraries this repo draws from (`obra/superpowers`, `anthropics/skills`, `cursor/plugins` pstack) are flat at 15 to 60 skills, and `mattpocock/skills` keeps only two buckets for 40. At 38 skills, a single index carries the whole library. Do not reintroduce a category folder.

## Index

- `README.md` holds the repo description, then `## User-invoked` and `## Model-invoked`, each a flat list of `- **[name](./skills/name/SKILL.md)**: one-line description.`
- The one-liner is our own human-facing summary of the skill, never a pasted trigger list. The skill name always links to its `SKILL.md` under `skills/`.
- Invocation is the axis the index sorts on. Every skill is either user-invoked (`disable-model-invocation: true`, reachable only as `/skill:<name>`, description read by a human) or model-invoked (no flag, description carries trigger phrasing). Keep whichever mode upstream chose.
- Entries are alphabetical within a section.
- Adding, renaming, or removing a skill, or flipping its invocation mode, updates `README.md` in the same change. An index that misses a skill, or routes to one that is gone, is a defect, not a chore for later.

## Skill references

A skill that points at another skill names it as `/<skill-name>`: ``run `/grilling` ``, ``see `/unslop` ``. Never as a path, not `~/.agents/skills/x/SKILL.md`, not `../x/SKILL.md`, not `$SKILLS_HOME/x/SKILL.md`. Paths are only for files the skill itself owns: its own `scripts/`, `references/`, and assets.

This is a Pi porting rule rather than upstream wording. When an upstream skill links another skill by path, or names Claude Code's Skill tool, convert that reference to `/<skill-name>` and change nothing else in the sentence. Report it like any other adaptation. The root index is navigation, not a reference: it keeps linking `./skills/name/SKILL.md`.

## Install a skill

1. Pin the upstream source to a revision (commit SHA or tag). Copy from upstream itself, never from a translation, port, or another agent's vendored copy.
2. Copy the skill directory to `skills/<skill-name>`, byte for byte, then confirm with `diff -r` against the source. Retyping upstream prose is a defect even when it looks equivalent.
3. Compare frontmatter field by field against upstream, not only the body. Keep `disable-model-invocation: true` when upstream has it.
4. Adapt only what cannot work on Pi, with a targeted edit. That means platform paths (`.cursor/skills/` becomes `.agents/skills/`), other agents' config paths, and vendor-specific tool names. Everything else stays as upstream wrote it.
5. Re-run `diff -r` against the source and state every changed line.
6. Link it and verify:

   ```bash
   node scripts/link-skills.mjs
   node scripts/link-skills.mjs --check
   ```

   `~/.agents/skills` is one symlink to `skills/`, so a new skill needs no per-skill link: run the script once if the link is missing or points elsewhere. It replaces an older per-skill directory only when every entry in it points back into this repo; otherwise it leaves the directory alone and tells you what it found. It does not read frontmatter, so check the invocation flag against upstream yourself.

7. Add the entry to `README.md` under the right invocation heading, and report the source and revision, plus any reference the copy left dangling (a playbook, skill, or path that does not exist here).

The user runs `/reload` in Pi after a skill or its frontmatter changes.

## Facts

- `~/.agents/skills` is Pi's user skill directory, and it is a single symlink to this repo's `skills/` folder. Every skill directory here is immediately a skill Pi can load.
- Because of that symlink, writing into `~/.agents/skills/<name>` writes into this repo's working tree. Tools that install skills by writing there modify the repo directly; treat those changes as unreviewed and verify them with `git status`.
- `scripts/link-skills.mjs` maintains the symlink; it is the only supported way to publish skills. Idempotent, no dependencies.
- `global-agents-principle.md` is the global principles asset. Publish it by symlink at `~/.agents/AGENTS.md` for shared consumers and at `~/.pi/agent/AGENTS.md` for Pi's native context loader. This repo's own instructions remain in this file.

## Verify library assets

| Check | Command |
| --- | --- |
| `~/.agents/skills` points at `skills/` | `node scripts/link-skills.mjs --check` |
| Flat layout, root index, frontmatter, invocation mode | `node scripts/check-assets.mjs` |
| Checker regression tests | `node --test scripts/*.test.mjs` |

`.github/workflows/validate-assets.yml` runs the last two on every push and pull request. The link check stays local, because CI has no `~/.agents/skills`.

## Don't

- Do not reword, shorten, or otherwise improve copied upstream text. Report the problem instead. The one exception is a cross-skill reference: convert it to `/<skill-name>` (see above).
- Do not install with `npx skills add`: it skips the pin and the `diff -r` verification, and writes an unverified copy straight into this working tree through the symlink.
- Do not create a category, bucket, or lifecycle folder under `skills/`. A retired skill is deleted, and git history is the archive.
- Do not put a real directory or file directly under `skills/`. Every entry there is a skill directory with a `SKILL.md`.
- Do not let `README.md` drift from `skills/`. Update it in the same change that touches the skill.
