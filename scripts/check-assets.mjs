#!/usr/bin/env node
// Validate the skill library: the flat `skills/` layout, the root index, and SKILL.md frontmatter.
// Zero dependencies, so CI needs no install step.
// Usage: node scripts/check-assets.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Parse the top-level keys of a `---` delimited frontmatter block. */
export function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end < 0) return null;

  const fields = {};
  let key = null;
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    const match = /^([A-Za-z0-9_-]+):(.*)$/.exec(line);
    if (match) {
      key = match[1];
      const value = match[2].trim();
      fields[key] = /^[|>][-+]?$/.test(value) ? "" : value;
    } else if (key && fields[key] === "" && line.trim() !== "") {
      fields[key] = line.trim();
    }
  }
  return fields;
}

// The root README is the only index. Every entry links `./skills/<skill>/SKILL.md`,
// and its invocation comes from the `## User-invoked` / `## Model-invoked` heading above it.
const ENTRY = /\]\(\.\/skills\/([^/)\s]+)\/SKILL\.md\)/;

function indexEntries(readme) {
  const entries = [];
  let declared = null;
  readme.split(/\r?\n/).forEach((line, i) => {
    const heading = /^##\s+(.*)$/.exec(line);
    if (heading) {
      const title = heading[1].toLowerCase();
      declared = title.includes("user-invoked") ? "user" : title.includes("model-invoked") ? "model" : null;
      return;
    }
    const match = ENTRY.exec(line);
    if (!match) return;
    entries.push({ name: match[1], declared, lineNo: i + 1 });
  });
  return entries;
}

function dirs(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function checkAssets(root) {
  const problems = [];
  const fail = (rule, file, message) => problems.push({ rule, file, message });

  const skillsDir = path.join(root, "skills");
  const readmeRel = "README.md";
  const readmePath = path.join(root, readmeRel);
  if (!fs.existsSync(readmePath)) {
    fail("root-readme-missing", readmeRel, "README.md is missing, so no skill is indexed");
    return problems;
  }
  const readme = fs.readFileSync(readmePath, "utf8");

  // `skills/` holds only skill directories. No category folders, no loose files.
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      fail("skills-stray-file", `skills/${entry.name}`, "skills/ holds only skill directories; this is a file");
    }
  }

  const entries = indexEntries(readme);
  const indexed = new Set(entries.map((entry) => entry.name));

  for (const entry of entries) {
    if (!fs.existsSync(path.join(skillsDir, entry.name, "SKILL.md"))) {
      fail("index-entry-unresolved", `${readmeRel}:${entry.lineNo}`, `"${entry.name}" has no skills/${entry.name}/SKILL.md`);
    }
  }

  // Entries are alphabetical within a section, so a new skill has one obvious home.
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const entry = entries[i];
    if (prev.declared === entry.declared && entry.name < prev.name) {
      fail("index-order", `${readmeRel}:${entry.lineNo}`, `"${entry.name}" comes after "${prev.name}"; entries are alphabetical`);
    }
  }
  if (entries.length === 0) fail("root-index-empty", readmeRel, "the index lists no skills");

  for (const name of dirs(skillsDir)) {
    const rel = `skills/${name}/SKILL.md`;
    const skillPath = path.join(skillsDir, name, "SKILL.md");
    if (!fs.existsSync(skillPath)) {
      fail("skill-no-skill-md", `skills/${name}`, "directory has no SKILL.md");
      continue;
    }
    if (!indexed.has(name)) fail("skill-not-indexed", readmeRel, `"${name}" has no entry in the index`);

    const fields = parseFrontmatter(fs.readFileSync(skillPath, "utf8"));
    if (fields === null) {
      fail("frontmatter-invalid", rel, "no `---` delimited frontmatter block at the top of the file");
      continue;
    }
    if (fields.name !== name) {
      fail("frontmatter-name-mismatch", rel, `name is "${fields.name ?? ""}", directory is "${name}"`);
    }
    if (!(fields.description ?? "").trim()) fail("frontmatter-description-missing", rel, "description is empty");

    const flagged = (fields["disable-model-invocation"] ?? "").trim().toLowerCase() === "true";
    const entry = entries.find((candidate) => candidate.name === name);
    if (!entry) continue;
    if (entry.declared === null) {
      fail("invocation-undeclared", `${readmeRel}:${entry.lineNo}`, `"${name}" is outside any invocation heading`);
    } else if (entry.declared === "user" && !flagged) {
      fail("invocation-mismatch", `${readmeRel}:${entry.lineNo}`, `"${name}" is listed as user-invoked but its frontmatter has no disable-model-invocation: true`);
    } else if (entry.declared === "model" && flagged) {
      fail("invocation-mismatch", `${readmeRel}:${entry.lineNo}`, `"${name}" is listed as model-invoked but its frontmatter sets disable-model-invocation: true`);
    }
  }

  return problems;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const problems = checkAssets(root);
  if (problems.length === 0) {
    console.log("skill library is consistent");
  } else {
    for (const { rule, file, message } of problems) console.log(`${file}: ${message} [${rule}]`);
    console.log(`${problems.length} problem${problems.length === 1 ? "" : "s"} found`);
    process.exitCode = 1;
  }
}
