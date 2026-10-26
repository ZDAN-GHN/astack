import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = fileURLToPath(new URL("../src/server.mjs", import.meta.url));
const fixture = fileURLToPath(new URL("./fixtures/fake-pi.mjs", import.meta.url));

function parseToolResult(result) {
  assert.ok(Array.isArray(result.content), "tool result should have content");
  return JSON.parse(result.content[0].text);
}

test("MCP stdio server exposes and runs the pi tools", async (t) => {
  const originalMode = fs.statSync(fixture).mode;
  fs.chmodSync(fixture, 0o755);
  t.after(() => fs.chmodSync(fixture, originalMode));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-mcp-"));
  const cwd = fs.mkdtempSync(path.join(root, "cwd-"));

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: {
      ...process.env,
      PI_SUBAGENT_PI_BIN: fixture,
      PI_SUBAGENT_CACHE_DIR: path.join(root, "cache"),
    },
    stderr: "pipe",
  });
  transport.stderr?.on("data", () => {});

  const client = new Client({ name: "pi-subagent-test", version: "0.0.0" });
  t.after(async () => {
    await client.close();
  });
  await client.connect(transport);

  const tools = await client.listTools();
  assert.deepEqual(
    tools.tools.map((tool) => tool.name).sort(),
    ["pi_delegate", "pi_job_abort", "pi_job_result", "pi_list_models"],
  );

  const ok = parseToolResult(
    await client.callTool({ name: "pi_delegate", arguments: { task: "[fake:ok]", cwd, wait_seconds: 10 } }),
  );
  assert.equal(ok.status, "completed");
  assert.equal(ok.text, "FAKE_OK");

  const models = parseToolResult(
    await client.callTool({ name: "pi_list_models", arguments: { search: "beam-free" } }),
  );
  assert.equal(models.count, 1);
  assert.equal(models.models[0].provider, "magpie");
  assert.equal(models.models[0].model, "opencode-go/beam-free");

  const unknownField = await client.callTool({
    name: "pi_delegate",
    arguments: { task: "x", cwd, bogus: true },
  });
  assert.equal(unknownField.isError, true);
  assert.match(unknownField.content[0].text, /invalid arguments/);

  const missing = await client.callTool({ name: "pi_job_result", arguments: { job_id: "missing" } });
  assert.equal(missing.isError, true);
  assert.match(missing.content[0].text, /No job/);

  for (const name of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    const response = await client.callTool({ name, arguments: {} });
    assert.equal(response.isError, true, `${name} should not resolve to a handler`);
    assert.match(response.content[0].text, /Unknown tool/);
  }

  const cancelCwd = fs.mkdtempSync(path.join(root, "cancel-"));
  const controller = new AbortController();
  const pending = client.callTool(
    { name: "pi_delegate", arguments: { task: "[fake:hang]", cwd: cancelCwd, wait_seconds: 55 } },
    undefined,
    { signal: controller.signal },
  );
  await new Promise((resolve) => setTimeout(resolve, 300));
  controller.abort();
  await assert.rejects(pending, (error) => error.name === "AbortError" || /abort/i.test(error.message));

  const afterCancel = parseToolResult(
    await client.callTool({
      name: "pi_delegate",
      arguments: { task: "[fake:ok]", cwd: cancelCwd, wait_seconds: 5 },
    }),
  );
  assert.equal(afterCancel.status, "completed", "cancelled job must not keep its cwd busy");

  const hang = parseToolResult(
    await client.callTool({
      name: "pi_delegate",
      arguments: { task: "[fake:hang]", cwd, wait_seconds: 0 },
    }),
  );
  assert.equal(hang.status, "running");

  const aborted = parseToolResult(
    await client.callTool({ name: "pi_job_abort", arguments: { job_id: hang.job_id } }),
  );
  assert.equal(aborted.status, "aborted");
});
