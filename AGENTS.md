# Agent Instructions

This repo is a skill library, not a project to build or test. Each directory under `skills/` is one Agent Skill, copied from an upstream source and published to `~/.agents/skills/` by symlink.

## Layout

| Item | Rule |
|---|---|
| Skill | `skills/<bucket>/<skill-name>/SKILL.md` |
| Bucket | Reuse an existing directory: `design` `education` `engineering` `process` `tools` |
| New bucket | Only when no existing one fits; lowercase, single word |
| Bucket index | `skills/<bucket>/README.md` lists every skill in the bucket |
| Root index | `README.md` lists the buckets only, never individual skills |
| Supporting files | `references/`, `scripts/`, and assets stay beside `SKILL.md` |
| Frontmatter | `name` must equal the skill directory name |

## Buckets and indexes

A bucket is a folder under `skills/`, and it is the unit that carries an index. The model is Matt Pocock's `mattpocock/skills` layout, minus the parts that serve a published plugin.

- `skills/<bucket>/README.md` starts with the bucket name and a one-line purpose, then groups entries under `## User-invoked` and `## Model-invoked`. Each entry is `- **[name](./name/SKILL.md)**: one-line description.` A bucket with a single skill uses a flat list with the invocation named on the line instead.
- The one-liner is our own human-facing summary of the skill, never a pasted trigger list. The skill name always links to its `SKILL.md`.
- The root `README.md` describes the repo and lists buckets with a one-line purpose each. A skill listed there as well would go stale twice, so it never is.
- No lifecycle buckets. There is no `misc/`, `in-progress/`, or `deprecated/`: a retired skill is deleted, and git history is the archive. Do not create an empty bucket.

Invocation is the axis the indexes sort on. Every skill is either user-invoked (`disable-model-invocation: true`, reachable only as `/skill:<name>`, description read by a human) or model-invoked (no flag, description carries trigger phrasing). Keep whichever mode upstream chose.

Adding, renaming, or removing a skill, or flipping its invocation mode, updates that bucket's `README.md` in the same change. An index that misses a skill, or routes to one that is gone, is a defect, not a chore for later. A new or removed bucket also updates the table in the root `README.md`.

## Skill references

A skill that points at another skill names it as `/<skill-name>`: ``run `/grilling` ``, ``see `/unslop` ``. Never as a path, not `~/.agents/skills/x/SKILL.md`, not `../x/SKILL.md`, not `$SKILLS_HOME/x/SKILL.md`. Paths are only for files the skill itself owns: its own `scripts/`, `references/`, and assets.

This is a Pi porting rule rather than upstream wording. When an upstream skill links another skill by path, or names Claude Code's Skill tool, convert that reference to `/<skill-name>` and change nothing else in the sentence. Report it like any other adaptation. Bucket indexes are navigation, not references: they keep linking `./name/SKILL.md`.

## Install a skill

1. Pin the upstream source to a revision (commit SHA or tag). Copy from upstream itself, never from a translation, port, or another agent's vendored copy.
2. Copy the skill directory into the chosen category, byte for byte, then confirm with `diff -r` against the source. Retyping upstream prose is a defect even when it looks equivalent.
3. Compare frontmatter field by field against upstream, not only the body. Keep `disable-model-invocation: true` when upstream has it.
4. Adapt only what cannot work on Pi, using `apply_patch`. That means platform paths (`.cursor/skills/` becomes `.agents/skills/`), other agents' config paths, and vendor-specific tool names. Everything else stays as upstream wrote it.
5. Re-run `diff -r` against the source and state every changed line.
6. Link it and verify the link resolves:

   ```bash
   node scripts/link-skills.mjs --check
   ```

   The script links every skill in `skills/` into `~/.agents/skills/`, replaces mismatched links, and prunes links whose target is gone. Run it without `--check` to write, with `--check` to verify. It does not read frontmatter, so check the invocation flag against upstream yourself.

7. Add or update the entry in that bucket's `README.md`, and report the source and revision, plus any reference the copy left dangling (a playbook, skill, or path that does not exist here).

The user runs `/reload` in Pi after a skill or its frontmatter changes.

## Facts

- `~/.agents/skills/` is Pi's user skill directory. Every entry in it is a symlink to a directory in this repo, one entry per skill.
- `scripts/link-skills.mjs` maintains those symlinks from `skills/`; it is the only supported way to publish a skill. Idempotent, no dependencies.
- Categorize by what the skill does, not by who published it.
- `global-agents-principle.md` is the global principles asset. Publish it by symlink at `~/.agents/AGENTS.md` for shared consumers and at `~/.pi/agent/AGENTS.md` for Pi's native context loader. This repo's own instructions remain in this file.

## Verify library assets

| Check | Command |
| --- | --- |
| Every skill linked into `~/.agents/skills/` | `node scripts/link-skills.mjs --check` |
| Bucket index matches `skills/` | by hand: every `SKILL.md` has a bucket `README.md` entry, every entry resolves |

`.github/workflows/validate-assets.yml` also runs `scripts/check-assets.mjs` and its regression fixtures. Those scripts are not in this tree, so CI fails on checkout until they are restored; do not treat a green local link check as a green CI run.

## Don't

- Do not reword, shorten, or otherwise improve copied upstream text. Report the problem instead. The one exception is a cross-skill reference: convert it to `/<skill-name>` (see above).
- Do not install with `npx skills add`: it writes into an agent's skill directory with no category and no link.
- Do not put a real directory under `~/.agents/skills/`. That entry is a symlink, and a copy there breaks updates.
- Do not let a bucket `README.md` drift from `skills/`. Update it in the same change that touches the skill.
