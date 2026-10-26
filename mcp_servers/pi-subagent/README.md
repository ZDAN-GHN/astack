# pi_subagent MCP server

本地 stdio MCP server，把任务委派给 pi coding agent，每次调用可以选择模型。Claude Code 通过 `pi_delegate` 启动一个独立的 pi 进程，读取结果、查询状态或中止任务。

## 要求

- Node.js 20 或更高版本。本机验证版本为 24.20.0。
- `pi` 在 `PATH` 中，或通过 `PI_SUBAGENT_PI_BIN` 指定可执行文件。本机验证版本为 1.4.0。
- pi 已配置可用的 provider 和凭证。

## 安装与注册

```bash
cd /home/zdan/github/astack/mcp_servers/pi-subagent
npm ci
```

注册到当前用户的 Claude Code 配置：

```bash
claude mcp add --scope user pi_subagent -- node /home/zdan/github/astack/mcp_servers/pi-subagent/src/server.mjs
```

注册后需要新开 Claude Code 会话，或在现有会话执行 `/mcp` 重连，工具才会出现。工具名为 `mcp__pi_subagent__pi_delegate`、`mcp__pi_subagent__pi_job_result`、`mcp__pi_subagent__pi_job_abort`、`mcp__pi_subagent__pi_list_models`。

移除注册：

```bash
claude mcp remove --scope user pi_subagent
```

如果 `node` 或 `pi` 不在 Claude Code 的 `PATH` 中，把注册命令里的 `node` 换成绝对路径，并加 `-e PI_SUBAGENT_PI_BIN=/absolute/path/to/pi`。

## 工具

| 工具 | 用途 |
| --- | --- |
| `pi_delegate` | 启动一个 pi 任务，等待最多 `wait_seconds`，返回任务结果或运行中的 job id。 |
| `pi_job_result` | 读取任务并等待最多 `wait_seconds`。`0` 表示立即返回状态。 |
| `pi_job_abort` | 中止排队中或运行中的任务。对已结束的任务是空操作。 |
| `pi_list_models` | 列出 pi 已配置的模型，可按文本过滤。 |

### pi_delegate 参数

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `task` | string | 必填 | 任务文本，通过 stdin 发给 pi，不放在命令行参数里。 |
| `model` | string | pi 默认模型 | 形如 `magpie/opencode-go/beam-free`。`default` 等同于不传。 |
| `thinking` | string | pi 默认 | `off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max`。 |
| `cwd` | string | server 进程的当前目录 | 必须是存在的绝对路径。会解析 symlink。续接会话时忽略，任务在会话原本的工作目录运行。 |
| `tools` | string | `read,bash,edit,write` | 只允许内置工具：`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`。 |
| `session_id` | string | 无 | 续接已持久化的 pi 会话。必须是完整 id，不支持前缀。会解析出会话文件并固定使用会话原本的 `cwd`。不能与 `ephemeral` 同用。 |
| `ephemeral` | boolean | `false` | 使用 `--no-session`，不保存会话。 |
| `trust_project` | boolean | pi 自己决定 | `true` 传 `--approve`，`false` 传 `--no-approve`。 |
| `timeout_seconds` | integer | `1800` | 执行超时，从进程启动开始算，不含排队时间。最大 `7200`。 |
| `wait_seconds` | integer | `45` | MCP 调用最多等待多久。超时只返回运行中的 job id，不会中止任务。最大 `55`。 |

`pi_job_result` 接受 `job_id` 和可选的 `wait_seconds`。`pi_job_abort` 只接受 `job_id`。`pi_list_models` 只接受可选的 `search`。

所有工具拒绝未知字段。

## 使用示例

选择模型，在指定目录改代码：

```json
{
  "task": "修复 src/foo.test.js 里失败的测试，并运行它",
  "model": "magpie/opencode-go/beam-free",
  "cwd": "/home/zdan/repo"
}
```

只读审查，收窄工具集：

```json
{
  "task": "审查当前 diff 的竞态问题，只报告，不改代码",
  "tools": "read,grep,find,ls",
  "cwd": "/home/zdan/repo"
}
```

续接同一个 pi 会话（不需要 `cwd`，server 会把任务放回会话原本的项目目录）：

```json
{
  "task": "为刚才的情况补一个回归测试",
  "session_id": "01a17852-8866-73b3-989c-44effee37a77"
}
```

如果显式传了 `cwd`，它必须与会话原本的工作目录一致，否则会拒绝，避免 pi 在 stdin 上询问是否要 fork 到另一个项目。`ephemeral` 会话没有落盘，不能续接。

长任务先拿 job id，再轮询：

```json
{ "task": "迁移所有调用点", "timeout_seconds": 3600, "wait_seconds": 10 }
{ "job_id": "<上一步返回的 id>", "wait_seconds": 45 }
```

## 行为

每次委派启动一个 `pi --mode json` 子进程。任务写入 stdin 后关闭 stdin，进程结束即任务结束。

调用方取消 MCP 请求时，`pi_delegate` 会中止对应任务（因为调用方还没拿到 job id）；`pi_job_result` 只停止等待，不中止任务；`pi_list_models` 会结束自己的子进程。

`ephemeral: true` 使用 `--no-session`。pi 的会话事件仍可能带一个 id，但这个会话不会写入磁盘，不能用来续接。

默认启动参数包含 `--no-extensions --no-mcp`。这样委派不会加载全局 pi 插件，也不会递归启动其他 MCP server 或 agent。pi 的模型配置、凭证、skills 和上下文文件仍然可用。

默认工具是 `read,bash,edit,write`。传入 `tools` 会整体替换默认集合。

同一个解析后的 `cwd` 同时只运行一个任务。同一个会话同时只运行一个任务。其他任务保持 `queued`，直到冲突任务真正退出。排队任务上限为 50 个。

续接会话时，server 会在 pi 的 session store 中按完整 id 查找会话文件，优先使用 `PI_CODING_AGENT_SESSION_DIR`，其次读取 `~/.pi/agent/settings.json` 的 `sessionDir`，否则使用 `~/.pi/agent/sessions`。找到后把绝对文件路径传给 `--session`，这样 pi 不会走跨项目的交互式 fork 询问。找不到会话时直接返回参数错误，不会启动 pi。

任务标记为 `completed` 需要同时满足：

- pi 退出码为 0。
- 至少一条 assistant 消息。
- 观察到 `agent_settled`。
- `stopReason` 不是 `error` 或 `aborted`。
- `agent_settled` 没有带 `aborted: true`。

`stopReason` 为 `length` 时算 `completed`，但 `warnings` 会说明输出被截断。

任务结果字段：

| 字段 | 说明 |
| --- | --- |
| `job_id`、`status` | 任务标识和状态：`queued`、`running`、`completed`、`failed`、`aborted`、`timeout`。 |
| `text` | 最后一条有文本的 assistant 消息，只包含 `text` 块，不包含 thinking。 |
| `text_truncated` | 文本是否被截断。 |
| `model` | pi 事件中实际使用的 `{provider, id}`，不是请求参数的回显。 |
| `session_id` | pi 会话 id。`ephemeral` 任务的事件里也可能带 id，但会话不保存，不能续接。 |
| `stop_reason`、`usage` | 最后一条消息的停止原因，以及所有 assistant 消息的用量合计。 |
| `tool_calls` | 工具调用摘要，包含名称、目标、是否成功、耗时。 |
| `changed_files` | 成功的内置 `write` 或 `edit` 观察到的文件，最多 200 个。 |
| `changed_files_truncated` | 是否因为超过 200 个而截断。 |
| `warnings` | 输出截断、stderr 等提示。 |
| `error`、`stderr_tail` | 失败、超时或中止时的原因。 |
| `events_path` | 原始 JSONL 事件日志。任务从未启动时可能为 `null`。 |
| `duration_ms` | 从进程启动到退出或当前时刻的毫秒数。 |

`changed_files` 只记录成功的内置写入工具。`bash` 和其他进程改动的文件不在其中，所以它不是完整的 git diff。

超时、中止和服务退出都会终止整个 pi 进程组。发送 `SIGTERM`，3 秒后发送 `SIGKILL`。

已结束的任务在内存中保留 1 小时，最多 50 个。MCP server 重启后任务记录丢失，但 pi 会话和事件日志仍然存在。

事件日志写在 `~/.cache/pi-subagent/runs/<job_id>.jsonl`。目录权限 `0700`，文件权限 `0600`。日志包含完整对话内容，不会自动清理；需要时手动删除该目录，或把 `PI_SUBAGENT_CACHE_DIR` 指向临时目录。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PI_SUBAGENT_PI_BIN` | `pi` | pi 可执行文件。不会搜索其他 nvm 版本目录。 |
| `PI_SUBAGENT_CACHE_DIR` | `~/.cache/pi-subagent` | 缓存根目录。 |
| `PI_SUBAGENT_MAX_TEXT_CHARS` | `50000` | 返回文本上限。 |
| `PI_SUBAGENT_MAX_TOOL_CALLS` | `100` | 返回的工具调用摘要上限。 |
| `PI_SUBAGENT_MAX_STDERR_CHARS` | `8000` | 保留的 stderr 尾部长度。 |

## 安全边界

pi 以启动 MCP server 的 OS 用户权限运行，不会像 Claude Code 那样逐个工具请求批准。MCP 工具调用本身是批准点。

`tools` 只是 pi 的工具允许列表。`cwd` 只是工作目录。`trust_project` 只影响 pi 对项目资源的信任。三者都不是文件系统或网络沙箱。`bash` 仍然可以访问该用户能访问的文件和网络。

默认禁用 pi 扩展和 MCP server，可以防止全局插件、递归委派和意外的外部服务启动。它不限制 pi 自身的工具能力。需要更窄的范围时，传 `tools: "read,grep,find,ls"` 一类只读集合。

每次任务实际运行的模型由 pi 的配置和凭证决定。`pi_list_models` 只能证明模型已配置，不能证明凭证可用。

同一个 MCP server 内的队列只防止本进程发起的冲突任务。其他 Claude Code 会话、手动 pi 进程或其他程序仍可能同时写同一个仓库。

## 测试

```bash
npm test
```

默认测试使用 `test/fixtures/fake-pi.mjs`，不调用模型，不联网。覆盖参数构造、会话解析、事件归约、模型表解析、排队、超时、中止、请求取消、进程组清理、日志失败与权限、MCP stdio 协议。

真实 pi 的端到端测试需要主动开启：

```bash
npm run test:live
```

它使用本机已验证的免费模型 `magpie/opencode-go/beam-free`，检查模型发现、实际模型选择、`write` 落盘和持久会话续接。测试会在临时目录写文件，并创建持久化的 pi 会话。

## 已知限制

- 不支持运行中转向或切换模型。每次任务是一个新进程。
- 没有并发开关。同一 `cwd` 和同一会话始终串行；排队任务最多 50 个。
- 会话续接依赖 pi 的标准 session store 布局。手动改过会话目录或重命名过会话文件的场景不支持。
- `tools` 只接受内置工具名，不支持 pi 扩展提供的工具。
- 任务记录只在内存中，MCP server 重启后无法查询旧 job id。
- 每次调用都支付 pi 的冷启动时间。
- 进程组清理只在 Linux 和 macOS 上验证，Windows 路径未测试。
