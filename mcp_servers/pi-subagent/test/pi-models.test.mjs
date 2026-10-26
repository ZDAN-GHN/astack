import test from "node:test";
import assert from "node:assert/strict";
import { parseModelTable } from "../src/pi-models.mjs";

const TABLE = [
  "provider  model                  context  max-out  thinking  images",
  "magpie    opencode-go/beam-free  1.0M     131.1K   yes       yes",
  "magpie    auto/deepseek-v4.1-flash  1.0M  64K      yes       no",
].join("\n");

test("parses the aligned pi model table", () => {
  const models = parseModelTable(TABLE);
  assert.equal(models.length, 2);
  assert.deepEqual(models[0], {
    provider: "magpie",
    model: "opencode-go/beam-free",
    context: "1.0M",
    max_out: "131.1K",
    thinking: "yes",
    images: "yes",
  });
  assert.equal(models[1].model, "auto/deepseek-v4.1-flash");
});

test("handles trailing CRLF and blank lines", () => {
  const models = parseModelTable(`${TABLE.replace(/\n/g, "\r\n")}\r\n`);
  assert.equal(models.length, 2);
});

test("stops at the blank line after the table instead of parsing trailing prose", () => {
  const models = parseModelTable(`${TABLE}\n\nUse --model provider/model to select one.\n`);
  assert.equal(models.length, 2);
});

test("returns an empty list when there is no header", () => {
  assert.deepEqual(parseModelTable(""), []);
  assert.deepEqual(parseModelTable("some warning\n"), []);
});

test("falls back to whitespace splitting when columns are ragged", () => {
  const models = parseModelTable("provider  model\nmagpie    model-a\n");
  assert.deepEqual(models, [
    { provider: "magpie", model: "model-a", context: null, max_out: null, thinking: null, images: null },
  ]);
});
