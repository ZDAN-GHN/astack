#!/usr/bin/env node
// Point ~/.agents/skills at this repo's skills/ folder with a single symlink, so every
// skill here is installed at once and a git pull keeps them current.
// Replaces the older layout of one symlink per skill. Refuses to discard anything in
// that directory that does not point back into this repo.
// Usage: node scripts/link-skills.mjs [--check]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(repo, "skills");
const agentsDir = path.join(process.env.HOME, ".agents");
const dest = path.join(agentsDir, "skills");
const checkOnly = process.argv.includes("--check");

/** Every entry in the legacy per-skill directory, reporting the ones this repo does not own. */
function legacyContents(dir) {
  const owned = [];
  const foreign = [];
  for (const entry of fs.readdirSync(dir)) {
    const link = path.join(dir, entry);
    let target = null;
    try {
      target = fs.readlinkSync(link);
    } catch {
      /* a real directory or file */
    }
    if (target !== null && path.resolve(dir, target).startsWith(repo + path.sep)) owned.push(entry);
    else foreign.push(entry);
  }
  return { owned, foreign };
}

let state;
try {
  state = fs.lstatSync(dest);
} catch {
  state = null;
}

if (state === null) {
  if (checkOnly) {
    console.log(`problem: ${dest} does not exist; run scripts/link-skills.mjs`);
    process.exitCode = 1;
  } else {
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.symlinkSync(src, dest);
    console.log(`linked ${dest} -> ${src}`);
  }
} else if (state.isSymbolicLink()) {
  const target = fs.readlinkSync(dest);
  if (path.resolve(agentsDir, target) === src) {
    console.log(`${dest} -> ${src}`);
  } else if (checkOnly) {
    console.log(`problem: ${dest} links to ${target}, expected ${src}`);
    process.exitCode = 1;
  } else {
    fs.rmSync(dest, { force: true });
    fs.symlinkSync(src, dest);
    console.log(`relinked ${dest} -> ${src} (was ${target})`);
  }
} else if (state.isDirectory()) {
  // The old layout: one symlink per skill, all pointing into this repo.
  const { owned, foreign } = legacyContents(dest);
  if (foreign.length > 0) {
    console.log(`problem: ${dest} holds entries that do not point into this repo, left alone: ${foreign.join(", ")}`);
    console.log("Move or remove them yourself, then re-run this script.");
    process.exitCode = 1;
  } else if (checkOnly) {
    console.log(`problem: ${dest} is still the per-skill directory (${owned.length} links); run scripts/link-skills.mjs`);
    process.exitCode = 1;
  } else {
    fs.rmSync(dest, { recursive: true, force: true });
    fs.symlinkSync(src, dest);
    console.log(`replaced the per-skill directory (${owned.length} links) with ${dest} -> ${src}`);
  }
} else {
  console.log(`problem: ${dest} exists and is neither a symlink nor a directory, left alone`);
  process.exitCode = 1;
}
