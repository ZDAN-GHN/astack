import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { checkAssets, parseFrontmatter } from "./check-assets.mjs";

const SKILL = (name, { user = false } = {}) =>
  `---\nname: ${name}\ndescription: does one thing\n${user ? "disable-model-invocation: true\n" : ""}---\n\n# ${name}\n`;

function library(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-assets-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [rel, content] of Object.entries(files)) {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

const README =
  "## User-invoked\n\n- **[alpha](./skills/alpha/SKILL.md)**: first.\n\n## Model-invoked\n\n- **[beta](./skills/beta/SKILL.md)**: second.\n";

test("a consistent library has no problems", (t) => {
  const root = library(t, {
    "README.md": README,
    "skills/alpha/SKILL.md": SKILL("alpha", { user: true }),
    "skills/beta/SKILL.md": SKILL("beta"),
  });
  assert.deepEqual(checkAssets(root), []);
});

test("a missing root README is reported", (t) => {
  const root = library(t, { "skills/beta/SKILL.md": SKILL("beta") });
  const rules = checkAssets(root).map((problem) => problem.rule);
  assert.deepEqual(rules, ["root-readme-missing"]);
});

test("an entry with no matching skill is reported", (t) => {
  const root = library(t, {
    "README.md": "## Model-invoked\n\n- **[beta](./skills/beta/SKILL.md)**: second.\n- **[ghost](./skills/ghost/SKILL.md)**: gone.\n",
    "skills/beta/SKILL.md": SKILL("beta"),
  });
  const rules = checkAssets(root).map((problem) => problem.rule);
  assert.deepEqual(rules, ["index-entry-unresolved"]);
});

test("a skill missing from the index is reported", (t) => {
  const root = library(t, {
    "README.md": "## Model-invoked\n\n- **[beta](./skills/beta/SKILL.md)**: second.\n",
    "skills/beta/SKILL.md": SKILL("beta"),
    "skills/gamma/SKILL.md": SKILL("gamma"),
  });
  const rules = checkAssets(root).map((problem) => problem.rule);
  assert.deepEqual(rules, ["skill-not-indexed"]);
});

test("frontmatter name must equal the directory name", (t) => {
  const root = library(t, {
    "README.md": "## Model-invoked\n\n- **[beta](./skills/beta/SKILL.md)**: second.\n",
    "skills/beta/SKILL.md": SKILL("renamed"),
  });
  const rules = checkAssets(root).map((problem) => problem.rule);
  assert.deepEqual(rules, ["frontmatter-name-mismatch"]);
});

test("invocation must agree between index and frontmatter", (t) => {
  const root = library(t, {
    "README.md": "## User-invoked\n\n- **[beta](./skills/beta/SKILL.md)**: second.\n",
    "skills/beta/SKILL.md": SKILL("beta"),
  });
  const [problem] = checkAssets(root);
  assert.equal(problem.rule, "invocation-mismatch");
  assert.match(problem.message, /user-invoked/);
});

test("an entry outside both invocation headings is reported", (t) => {
  const root = library(t, {
    "README.md": "# title\n\n- **[beta](./skills/beta/SKILL.md)**: second.\n",
    "skills/beta/SKILL.md": SKILL("beta"),
  });
  const rules = checkAssets(root).map((problem) => problem.rule);
  assert.deepEqual(rules, ["invocation-undeclared"]);
});

test("a directory without SKILL.md is reported", (t) => {
  const root = library(t, {
    "README.md": "## Model-invoked\n\n- **[beta](./skills/beta/SKILL.md)**: second.\n",
    "skills/beta/SKILL.md": SKILL("beta"),
    "skills/half-written/notes.md": "work in progress\n",
  });
  const rules = checkAssets(root).map((problem) => problem.rule);
  assert.deepEqual(rules, ["skill-no-skill-md"]);
});

test("a loose file in skills/ is reported", (t) => {
  const root = library(t, {
    "README.md": "## Model-invoked\n\n- **[beta](./skills/beta/SKILL.md)**: second.\n",
    "skills/beta/SKILL.md": SKILL("beta"),
    "skills/README.md": "leftover bucket index\n",
  });
  const rules = checkAssets(root).map((problem) => problem.rule);
  assert.deepEqual(rules, ["skills-stray-file"]);
});

test("entries out of alphabetical order are reported", (t) => {
  const root = library(t, {
    "README.md": "## Model-invoked\n\n- **[beta](./skills/beta/SKILL.md)**: second.\n- **[alpha](./skills/alpha/SKILL.md)**: first.\n",
    "skills/alpha/SKILL.md": SKILL("alpha"),
    "skills/beta/SKILL.md": SKILL("beta"),
  });
  const rules = checkAssets(root).map((problem) => problem.rule);
  assert.deepEqual(rules, ["index-order"]);
});

test("frontmatter parsing reads block scalars", () => {
  const fields = parseFrontmatter("---\nname: x\ndescription: |\n  line one\n  line two\n---\n");
  assert.equal(fields.name, "x");
  assert.equal(fields.description, "line one");
});

test("frontmatter parsing rejects a missing block", () => {
  assert.equal(parseFrontmatter("# no frontmatter\n"), null);
  assert.equal(parseFrontmatter("---\nname: x\n"), null);
});
