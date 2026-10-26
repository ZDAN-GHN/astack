import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = fileURLToPath(new URL("../../src/server.mjs", import.meta.url));
const MODEL = "magpie/opencode-go/beam-free";
const enabled = process.env.PI_SUBAGENT_E2E === "1";

test("live pi delegation", { skip: !enabled && "set PI_SUBAGENT_E2E=1 to run live pi tests" }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-live-"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: {
      ...process.env,
      PI_SUBAGENT_CACHE_DIR: path.join(root, "cache"),
    },
    stderr: "pipe",
  });
  transport.stderr?.on("data", () => {});

  const client = new Client({ name: "pi-live-test", version: "0.0.0" });
  t.after(async () => {
    await client.close();
  });
  await client.connect(transport);

  await t.test("lists the configured free model", async () => {
    const result = await call(client, "pi_list_models", { search: "beam-free" });
    assert.ok(result.count >= 1);
    assert.ok(result.models.some((model) => model.provider === "magpie" && model.model === "opencode-go/beam-free"));
  });

  await t.test("ephemeral run selects the requested model", async () => {
    const token = `TOKEN-${Date.now().toString(36)}`;
    const result = await delegate(client, {
      task: `Reply with exactly this token and nothing else: ${token}`,
      model: MODEL,
      ephemeral: true,
      timeout_seconds: 300,
    });
    assert.equal(result.status, "completed", result.error ?? "");
    assert.match(result.text, new RegExp(token));
    assert.ok(result.model, "actual model should be reported");
    assert.match(result.model.id, /beam-free/);
    assert.ok(result.usage, "usage should be reported");
  });

  await t.test("write tool creates the file on disk", async () => {
    const workdir = fs.mkdtempSync(path.join(root, "write-"));
    const result = await delegate(client, {
      task:
        "Create a file named proof.txt in the current directory with the exact content hello-pi. " +
        "Use the write tool, then reply DONE.",
      cwd: workdir,
      tools: "write",
      model: MODEL,
      ephemeral: true,
      timeout_seconds: 300,
    });
    assert.equal(result.status, "completed", result.error ?? "");
    const content = fs.readFileSync(path.join(workdir, "proof.txt"), "utf8");
    assert.equal(content.trim(), "hello-pi");
    assert.ok(
      result.changed_files.includes(path.join(workdir, "proof.txt")),
      `changed_files: ${JSON.stringify(result.changed_files)}`,
    );
  });

  await t.test("persisted session recalls an earlier word from its own project", async () => {
    const word = `word-${Date.now().toString(36)}`;
    const workdir = fs.mkdtempSync(path.join(root, "session-"));
    const first = await delegate(client, {
      task: `Remember this exact word for the rest of this session: ${word}. Reply OK.`,
      cwd: workdir,
      model: MODEL,
      timeout_seconds: 300,
    });
    assert.equal(first.status, "completed", first.error ?? "");
    assert.ok(first.session_id, "first run should report a session id");

    // No cwd: the server must resolve the session's project and pass the
    // absolute session file, so pi never asks its interactive fork question.
    const second = await delegate(client, {
      task: "What exact word did I ask you to remember? Reply with only that word.",
      session_id: first.session_id,
      model: MODEL,
      timeout_seconds: 300,
    });
    assert.equal(second.status, "completed", second.error ?? "");
    assert.match(second.text, new RegExp(word));
  });
});

async function delegate(client, args) {
  let result = await call(client, "pi_delegate", args);
  while (result.status === "queued" || result.status === "running") {
    result = await call(client, "pi_job_result", { job_id: result.job_id, wait_seconds: 55 });
  }
  return result;
}

async function call(client, name, args) {
  const response = await client.callTool({ name, arguments: args });
  if (response.isError) {
    throw new Error(`${name} failed: ${response.content?.[0]?.text ?? "unknown error"}`);
  }
  return JSON.parse(response.content[0].text);
}
