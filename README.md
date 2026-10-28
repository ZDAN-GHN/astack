# astack

My agent skill library. Each directory under `skills/` is one Agent Skill, copied byte for byte from an upstream source, adapted only where Pi needs it, and published by symlink into `~/.agents/skills/`.

## Buckets

A bucket is a folder under `skills/`. It groups skills by the work they do, and it is the unit that gets an index.

| Bucket | What lives there |
|---|---|
| [`design/`](./skills/design/README.md) | Visual and interaction design |
| [`education/`](./skills/education/README.md) | Learning and teaching material |
| [`engineering/`](./skills/engineering/README.md) | Daily code work: design, diagnosis, review |
| [`process/`](./skills/process/README.md) | How a session runs: interviews, handoffs, retros, notes |
| [`tools/`](./skills/tools/README.md) | Skills wrapped around a script, a file format, or a service |

Each bucket's `README.md` lists every skill in it with a one-line description and links the name to its `SKILL.md`. Those indexes are the only place skill lists live, so adding, renaming, or removing a skill means editing one bucket README, not two.

## Invocation

Every skill is one of two kinds:

- **User-invoked**: `disable-model-invocation: true` in the frontmatter, so only `/skill:<name>` reaches it. Its description is read by a human.
- **Model-invoked**: no such flag, so the model can also reach for it on its own. Its description carries trigger phrasing.

Bucket READMEs group entries under those two headings.

## Work on it

```bash
node scripts/link-skills.mjs          # link every skill into ~/.agents/skills
node scripts/link-skills.mjs --check  # report missing, mismatched, and stale links
```

Then run `/reload` in Pi. Conventions for installing, adapting, and indexing skills live in [`AGENTS.md`](./AGENTS.md).
