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

const ROOT_README = "| Bucket |\n| --- |\n| [`one/`](./skills/one/README.md) |\n";

test("a consistent library has no problems", (t) => {
  const root = library(t, {
    "README.md": ROOT_README,
    "skills/one/README.md": "## User-invoked\n\n- **[alpha](./alpha/SKILL.md)**: first.\n\n## Model-invoked\n\n- **[beta](./beta/SKILL.md)**: second.\n",
    "skills/one/alpha/SKILL.md": SKILL("alpha", { user: true }),
    "skills/one/beta/SKILL.md": SKILL("beta"),
  });
  assert.deepEqual(checkAssets(root), []);
});

test("a flat index may name the mode on the line", (t) => {
  const root = library(t, {
    "README.md": ROOT_README,
    "skills/one/README.md": "- **[alpha](./alpha/SKILL.md)**: first. User-invoked.\n",
    "skills/one/alpha/SKILL.md": SKILL("alpha", { user: true }),
  });
  assert.deepEqual(checkAssets(root), []);
});

test("an entry with no matching skill is reported", (t) => {
  const root = library(t, {
    "README.md": ROOT_README,
    "skills/one/README.md": "- **[ghost](./ghost/SKILL.md)**: gone. Model-invoked.\n- **[alpha](./alpha/SKILL.md)**: first. Model-invoked.\n",
    "skills/one/alpha/SKILL.md": SKILL("alpha"),
  });
  const rules = checkAssets(root).map((problem) => problem.rule);
  assert.deepEqual(rules, ["index-entry-unresolved"]);
});

test("a skill missing from its bucket index is reported", (t) => {
  const root = library(t, {
    "README.md": ROOT_README,
    "skills/one/README.md": "- **[alpha](./alpha/SKILL.md)**: first. Model-invoked.\n",
    "skills/one/alpha/SKILL.md": SKILL("alpha"),
    "skills/one/beta/SKILL.md": SKILL("beta"),
  });
  const rules = checkAssets(root).map((problem) => problem.rule);
  assert.deepEqual(rules, ["skill-not-indexed"]);
});

test("frontmatter name must equal the directory name", (t) => {
  const root = library(t, {
    "README.md": ROOT_README,
    "skills/one/README.md": "- **[alpha](./alpha/SKILL.md)**: first. Model-invoked.\n",
    "skills/one/alpha/SKILL.md": SKILL("renamed"),
  });
  const rules = checkAssets(root).map((problem) => problem.rule);
  assert.deepEqual(rules, ["frontmatter-name-mismatch"]);
});

test("invocation must agree between index and frontmatter", (t) => {
  const root = library(t, {
    "README.md": ROOT_README,
    "skills/one/README.md": "## User-invoked\n\n- **[alpha](./alpha/SKILL.md)**: first.\n",
    "skills/one/alpha/SKILL.md": SKILL("alpha"),
  });
  const [problem] = checkAssets(root);
  assert.equal(problem.rule, "invocation-mismatch");
  assert.match(problem.message, /user-invoked/);
});

test("a flat entry that names no mode is reported", (t) => {
  const root = library(t, {
    "README.md": ROOT_README,
    "skills/one/README.md": "- **[alpha](./alpha/SKILL.md)**: first.\n",
    "skills/one/alpha/SKILL.md": SKILL("alpha"),
  });
  const rules = checkAssets(root).map((problem) => problem.rule);
  assert.deepEqual(rules, ["invocation-undeclared"]);
});

test("a bucket absent from the root index is reported", (t) => {
  const root = library(t, {
    "README.md": "| Bucket |\n| --- |\n",
    "skills/one/README.md": "- **[alpha](./alpha/SKILL.md)**: first. Model-invoked.\n",
    "skills/one/alpha/SKILL.md": SKILL("alpha"),
  });
  const rules = checkAssets(root).map((problem) => problem.rule);
  assert.deepEqual(rules, ["bucket-not-in-root-index"]);
});

test("a bucket directory without SKILL.md is reported", (t) => {
  const root = library(t, {
    "README.md": ROOT_README,
    "skills/one/README.md": "- **[alpha](./alpha/SKILL.md)**: first. Model-invoked.\n",
    "skills/one/alpha/SKILL.md": SKILL("alpha"),
    "skills/one/half-written/notes.md": "work in progress\n",
  });
  const rules = checkAssets(root).map((problem) => problem.rule);
  assert.deepEqual(rules, ["skill-no-skill-md"]);
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
