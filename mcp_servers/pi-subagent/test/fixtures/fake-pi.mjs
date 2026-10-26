#!/usr/bin/env node
import path from "node:path";

const args = process.argv.slice(2);

function write(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function argValue(flag) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

if (args.includes("--list-models")) {
  const index = args.indexOf("--list-models");
  const search = args[index + 1];
  const rows = [
    ["magpie", "opencode-go/beam-free", "1.0M", "131.1K", "yes", "yes"],
    ["fake", "fake-model", "128K", "8K", "no", "no"],
  ].filter((row) => !search || row.join(" ").includes(search));
  const header = ["provider", "model", "context", "max-out", "thinking", "images"];
  const widths = header.map((cell, column) =>
    Math.max(cell.length, ...rows.map((row) => row[column].length)),
  );
  const formatRow = (row) =>
    row.map((cell, column) => (column === row.length - 1 ? cell : cell.padEnd(widths[column]))).join("  ");
  process.stdout.write(`${formatRow(header)}\n`);
  for (const row of rows) process.stdout.write(`${formatRow(row)}\n`);
  process.exitCode = 0;
} else {
  let task = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    task += chunk;
  });
  process.stdin.on("end", () => {
    void run(task);
  });
}

async function run(task) {
  const mode = /\[fake:([a-z-]+)\]/.exec(task)?.[1] ?? "ok";
  const model = argValue("--model") ?? "fake/default";
  const sessionArg = argValue("--session");
  const sessionId = sessionArg
    ? path.basename(sessionArg, ".jsonl").split("_").pop()
    : "fake-session-1";
  const ephemeral = args.includes("--no-session");

  if (!ephemeral) {
    write({ type: "session", id: sessionId, cwd: process.cwd() });
  }

  if (mode === "fail") {
    process.stderr.write("fake failure from pi\n");
    process.exitCode = 1;
    return;
  }

  if (mode === "badjson") {
    process.stdout.write("this is not json\n");
    process.exitCode = 0;
    return;
  }

  if (mode === "hang") {
    emitMessage({ text: "FAKE_HANG", model, stopReason: "stop" });
    setInterval(() => {}, 1000);
    return;
  }

  if (mode === "tree") {
    const { spawn } = await import("node:child_process");
    const pidFile = process.env.FAKE_PI_CHILD_PID_FILE;
    spawn(
      process.execPath,
      [
        "-e",
        `require("fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000);`,
      ],
      { stdio: "ignore" },
    );
    emitMessage({ text: "TREE", model, stopReason: "stop" });
    setInterval(() => {}, 1000);
    return;
  }

  if (mode === "slow") {
    await delay(300);
    emitMessage({ text: "FAKE_SLOW", model, stopReason: "stop" });
    write({ type: "agent_settled" });
    process.exitCode = 0;
    return;
  }

  if (mode === "multi") {
    emitMessage({ text: "one", model, stopReason: "toolUse" });
    emitMessage({ text: "two", model, stopReason: "stop" });
    write({ type: "agent_settled" });
    process.exitCode = 0;
    return;
  }

  if (mode === "length") {
    emitMessage({ text: "PARTIAL", model, stopReason: "length" });
    write({ type: "agent_settled" });
    process.exitCode = 0;
    return;
  }

  if (mode === "nosettle") {
    emitMessage({ text: "NO_SETTLE", model, stopReason: "stop" });
    process.exitCode = 0;
    return;
  }

  if (mode === "tool" || mode === "toolfail") {
    const failed = mode === "toolfail";
    write({
      type: "tool_execution_start",
      toolCallId: "call-1",
      toolName: "write",
      args: { path: "proof.txt", content: "hello" },
    });
    write({
      type: "tool_execution_end",
      toolCallId: "call-1",
      toolName: "write",
      result: {},
      isError: failed,
      durationMs: 4,
    });
    emitMessage({ text: failed ? "TOOL_FAILED" : "WROTE", model, stopReason: "stop" });
    write({ type: "agent_settled" });
    process.exitCode = 0;
    return;
  }

  if (mode === "thinking") {
    write({
      type: "message_end",
      message: {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "\u001b[38;5;5msecret reasoning" },
          { type: "text", text: "VISIBLE" },
        ],
        provider: "fake",
        model,
        stopReason: "stop",
        usage: usage(),
      },
    });
    write({ type: "agent_settled" });
    process.exitCode = 0;
    return;
  }

  if (mode === "unicode") {
    const text = "中文-😀-ok";
    const event = {
      type: "message_end",
      message: {
        role: "assistant",
        content: [{ type: "text", text }],
        provider: "fake",
        model,
        stopReason: "stop",
        usage: usage(),
      },
    };
    const line = Buffer.from(`${JSON.stringify(event)}\n`, "utf8");
    const split = Math.max(1, line.indexOf(Buffer.from("😀", "utf8")) + 1);
    process.stdout.write(line.subarray(0, split));
    await delay(20);
    process.stdout.write(line.subarray(split));
    write({ type: "agent_settled" });
    process.exitCode = 0;
    return;
  }

  if (mode === "args") {
    emitMessage({ text: JSON.stringify(args), model, stopReason: "stop" });
    write({ type: "agent_settled" });
    process.exitCode = 0;
    return;
  }

  emitMessage({ text: mode === "echo" ? task : "FAKE_OK", model, stopReason: "stop" });
  write({ type: "agent_settled" });
  process.exitCode = 0;
}

function usage() {
  return {
    input: 10,
    output: 5,
    cacheRead: 1,
    cacheWrite: 0,
    totalTokens: 16,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.001 },
  };
}

function emitMessage({ text, model, stopReason }) {
  write({
    type: "message_end",
    message: {
      role: "assistant",
      content: [{ type: "text", text }],
      provider: "fake",
      model,
      stopReason,
      usage: usage(),
    },
  });
}
