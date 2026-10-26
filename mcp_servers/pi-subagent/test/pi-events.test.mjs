import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { EventAccumulator, ProtocolError, extractText } from "../src/pi-events.mjs";

const cwd = "/tmp/pi-events-cwd";

function makeAccumulator({ maxToolCalls = 100, maxTextChars = 50000 } = {}) {
  return new EventAccumulator({ cwd, maxToolCalls, maxTextChars });
}

function feed(accumulator, events) {
  for (const event of events) accumulator.handle(JSON.stringify(event));
}

function assistant(content, overrides = {}) {
  return {
    type: "message_end",
    message: {
      role: "assistant",
      content,
      provider: "magpie",
      model: "opencode-go/beam-free",
      stopReason: "stop",
      usage: {
        input: 10,
        output: 5,
        cacheRead: 2,
        cacheWrite: 1,
        totalTokens: 18,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.002 },
      },
      ...overrides,
    },
  };
}

test("extractText keeps only text blocks", () => {
  assert.equal(
    extractText([
      { type: "thinking", thinking: "\u001b[38;5;5msecret" },
      { type: "text", text: "answer" },
      { type: "toolCall", name: "read" },
    ]),
    "answer",
  );
  assert.equal(extractText("plain"), "plain");
  assert.equal(extractText(null), "");
});

test("final text comes from the last assistant message with text", () => {
  const accumulator = makeAccumulator();
  feed(accumulator, [
    { type: "session", id: "session-1", cwd },
    assistant([{ type: "text", text: "first" }], { stopReason: "toolUse" }),
    assistant([{ type: "text", text: "second" }]),
    { type: "agent_settled" },
  ]);
  const summary = accumulator.summarize();
  assert.equal(summary.text, "second");
  assert.equal(summary.text_truncated, false);
  assert.equal(summary.session_id, "session-1");
  assert.deepEqual(summary.model, { provider: "magpie", id: "opencode-go/beam-free" });
  assert.equal(summary.stop_reason, "stop");
  assert.equal(summary.settled, true);
});

test("usage is summed once per assistant message", () => {
  const accumulator = makeAccumulator();
  feed(accumulator, [
    assistant([{ type: "text", text: "one" }]),
    assistant([{ type: "text", text: "two" }]),
    { type: "agent_settled" },
  ]);
  const summary = accumulator.summarize();
  assert.deepEqual(summary.usage, {
    input: 20,
    output: 10,
    cache_read: 4,
    cache_write: 2,
    total: 36,
    cost_total: 0.004,
  });
});

test("text is truncated after filtering thinking blocks", () => {
  const accumulator = makeAccumulator({ maxTextChars: 4 });
  feed(accumulator, [
    assistant([
      { type: "thinking", thinking: "\u001b[38;5;5m".repeat(100) },
      { type: "text", text: "abcdefghij" },
    ]),
    { type: "agent_settled" },
  ]);
  const summary = accumulator.summarize();
  assert.equal(summary.text, "abcd");
  assert.equal(summary.text_truncated, true);
});

test("tool calls are summarized and successful writes are recorded", () => {
  const accumulator = makeAccumulator({ maxToolCalls: 2 });
  feed(accumulator, [
    {
      type: "tool_execution_start",
      toolCallId: "call-1",
      toolName: "write",
      args: { path: "out.txt", content: "x" },
    },
    {
      type: "tool_execution_end",
      toolCallId: "call-1",
      toolName: "write",
      result: {},
      isError: false,
      durationMs: 7,
    },
    {
      type: "tool_execution_start",
      toolCallId: "call-2",
      toolName: "edit",
      args: { path: "bad.txt", edits: [] },
    },
    {
      type: "tool_execution_end",
      toolCallId: "call-2",
      toolName: "edit",
      result: {},
      isError: true,
      durationMs: 2,
    },
    {
      type: "tool_execution_start",
      toolCallId: "call-3",
      toolName: "bash",
      args: { command: "ls -la " + "x".repeat(200) },
    },
    {
      type: "tool_execution_end",
      toolCallId: "call-3",
      toolName: "bash",
      result: {},
      isError: false,
      durationMs: 9,
    },
  ]);
  const summary = accumulator.summarize();
  assert.equal(summary.tool_calls.length, 2);
  assert.equal(summary.tool_calls_truncated, true);
  assert.deepEqual(summary.tool_calls[0], {
    name: "write",
    target: "out.txt",
    ok: true,
    duration_ms: 7,
  });
  assert.deepEqual(summary.changed_files, [path.resolve(cwd, "out.txt")]);
});

test("changed_files is bounded and reports truncation", () => {
  const accumulator = makeAccumulator();
  for (let index = 0; index < 201; index += 1) {
    accumulator.handle(
      JSON.stringify({
        type: "tool_execution_start",
        toolCallId: `c${index}`,
        toolName: "write",
        args: { path: `f${index}.txt` },
      }),
    );
    accumulator.handle(
      JSON.stringify({
        type: "tool_execution_end",
        toolCallId: `c${index}`,
        toolName: "write",
        result: {},
        isError: false,
        durationMs: 1,
      }),
    );
  }
  const summary = accumulator.summarize();
  assert.equal(summary.changed_files.length, 200);
  assert.equal(summary.changed_files_truncated, true);
});

test("unknown events are ignored and settled aborted is captured", () => {
  const accumulator = makeAccumulator();
  feed(accumulator, [
    { type: "future_event", payload: { anything: true } },
    assistant([{ type: "text", text: "x" }]),
    { type: "agent_settled", aborted: true },
  ]);
  const summary = accumulator.summarize();
  assert.equal(summary.settled, true);
  assert.equal(summary.settled_aborted, true);
});

test("malformed lines and non-event objects fail", () => {
  const accumulator = makeAccumulator();
  assert.throws(() => accumulator.handle("{oops"), ProtocolError);
  assert.throws(() => accumulator.handle("[1,2,3]"), ProtocolError);
  assert.throws(() => accumulator.handle('{"no":"type"}'), ProtocolError);
  assert.doesNotThrow(() => accumulator.handle("   "));
});
