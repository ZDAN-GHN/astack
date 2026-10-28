#!/usr/bin/env node
// Link every skill in skills/<category>/<skill>/ into ~/.agents/skills/<skill>.
// Every entry is a symlink into this repo, so a git pull keeps installs current.
// Usage: node scripts/link-skills.mjs [--check]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dest = path.join(process.env.HOME, ".agents", "skills");
const checkOnly = process.argv.includes("--check");

const skills = fs
  .readdirSync(path.join(repo, "skills"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((cat) =>
    fs
      .readdirSync(path.join(repo, "skills", cat.name), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ name: d.name, src: path.join(repo, "skills", cat.name, d.name) }))
      .filter((s) => fs.existsSync(path.join(s.src, "SKILL.md"))),
  );

if (!checkOnly) fs.mkdirSync(dest, { recursive: true });

let ok = 0;
const problems = [];
for (const { name, src } of skills) {
  const link = path.join(dest, name);
  let current = null;
  try {
    current = fs.readlinkSync(link);
  } catch {
    /* missing or not a symlink */
  }
  if (current === src) {
    ok++;
    continue;
  }
  if (checkOnly) {
    problems.push(`${name}: ${current ? `links to ${current}` : "not linked"}`);
    continue;
  }
  if (current === null && fs.existsSync(link)) problems.push(`${name}: real directory in the way, left alone`);
  else {
    fs.rmSync(link, { force: true });
    fs.symlinkSync(src, link);
    ok++;
  }
}

// Stale links: point into this repo but at a skill that no longer exists. Safe to drop:
// they are dangling symlinks, not data.
const stale = fs
  .readdirSync(dest)
  .filter((e) => {
    try {
      const t = fs.readlinkSync(path.join(dest, e));
      return t.startsWith(repo + path.sep) && !fs.existsSync(t);
    } catch {
      return false;
    }
  });
if (!checkOnly) for (const s of stale) fs.rmSync(path.join(dest, s), { force: true });

console.log(`${ok}/${skills.length} skills linked into ${dest}`);
for (const p of problems) console.log(`problem: ${p}`);
for (const s of stale) console.log(`${checkOnly ? "stale" : "pruned"}: ${s}`);
if (problems.length || stale.length) process.exitCode = 1;
