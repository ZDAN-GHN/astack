---
name: video-transcribe
description: 把 Bilibili 视频或本地音频转成带时间戳的中文转写文本（transcript.md + input.json），并默认基于转写生成阅读报告、摘要或笔记：用户指定类型时从其指定，未指定时按内容给三种类型打匹配度，80 分以上的全部生成。零 pip 依赖，支持 SiliconFlow 远程免费转写（阿里 FunAudioLLM/SenseVoiceSmall）与 whisper.cpp 本地转写，引擎可配置；也可直接在 shell 里运行 extract.sh。
disable-model-invocation: true
---

# video-transcribe：视频/音频 → 转写 → 报告/摘要/笔记

把 B 站视频或本地音频转成带时间戳的中文转写，再默认基于转写生成阅读
报告/摘要/笔记。用户只要转写时，做到第 3 步为止。

## 工作流

### 第 1 步：检查环境

操作：
- 逐个确认 `ffmpeg -version`、`python3 --version`、`curl --version` 可用。

验收：
- 三条命令都有版本输出；缺哪个先补哪个，否则后续必然失败。

### 第 2 步：选定转写引擎并配置

操作：
- 默认 `whisper-cpp`（本地离线，默认模型 large-v3-turbo）。
- 本机内存 ≤16GB、CPU 紧张或非 Linux x86_64 平台 → 改用 `siliconflow`
  （远程免费，SiliconFlow 托管阿里 FunAudioLLM/SenseVoiceSmall）：
  把技能根目录 `extract.conf.example` 复制为 `extract.conf`，写入

  ```sh
  ENGINE=siliconflow
  SILICONFLOW_API_KEY=sk-你的key    # cloud.siliconflow.cn/account/ak 免费创建
  ```

  key 也可用环境变量 `SILICONFLOW_API_KEY` 传入。优先级：命令行参数 >
  环境变量 > extract.conf > 默认值。
- `whisper-cpp` 首次使用先 bootstrap（下载 yt-dlp、whisper.cpp 预编译
  二进制与模型到技能根目录 `.tools/`；large-v3-turbo 约 1.6GB，
  `tiny`/`base` 中文质量差、只用来验证链路）：

  ```sh
  ~/.agents/skills/video-transcribe/scripts/extract.sh --bootstrap
  ```

验收：
- siliconflow：`extract.conf` 存在，`ENGINE=siliconflow` 且 key 非空。
- whisper-cpp：`.tools/` 下有 whisper 可执行文件与 `ggml-*.bin` 模型；
  已有缓存时重复 bootstrap 不重复下载。

### 第 3 步：执行转写

操作：

```sh
~/.agents/skills/video-transcribe/scripts/extract.sh '<B站视频URL>'
# 或本地音频：
~/.agents/skills/video-transcribe/scripts/extract.sh --audio 录音.m4a --out 输出目录
```

- 常用参数：`--engine`、`--model`、`--language`（默认 zh）、`--threads`、
  `--out`（默认 `./transcripts/<视频id或时间戳>`）。
- 失败按报错对号处理：
  - `Failed to extract play info` / HTTP 412 → B 站限流，稍等重跑
    （已下载的音频会复用，不会重复触发限流）；
  - 401 → key 未配置或失效，回第 2 步；
  - 429 → 脚本自动退避重试，持续 429 则稍后再跑；
  - 输出为繁体 → 装有 opencc 模块时 format.py 已自动转简体，
    没装则留给第 5 步写作时转换。

验收：
- 输出目录里 `transcript.md` 与 `input.json` 都存在且非空；
  `source.*` 与 `source.info.json`（原始音频与元数据）一并落盘。
- `transcript.md`：首两行为标题与来源（Bilibili；UP主；《标题》；链接，
  本地音频时省略），其后每行形如 `[unit-000001 | 0.000–8.820s] 正文`，
  编号从 1 连续递增、无空段（零时长段已自动丢弃）。
- `input.json` 含标题、时长、链接、引擎与模型配置。
- 同一 BV 的多 P 视频：URL 带 `?p=N` 时输出目录名带 `-pN`，互不覆盖。
- 用户明确"只要转写" → 到此交付，停止。

### 第 4 步：判定加工类型

操作：
- 用户指定了类型（阅读报告 / 摘要 / 笔记）→ 只生成指定的。
- 未指定 → 通读 `transcript.md`（结合 `input.json` 的标题与简介），
  给三种类型各打 0–100 的内容匹配度：≥80 分的全部生成；
  都不足 80 时只生成得分最高的一个。

验收：
- 生成的类型集合与打分规则一致；回复里列出各类型得分与判定理由。

### 第 5 步：生成成稿

操作（各类型结构）：
- **阅读报告 `report.md`**（完整叙事/论证、值得细读：教程、深度讲解、
  访谈、纪录片、演讲）：元信息（标题、UP主、时长、链接）→ 内容概览 →
  按主题分节梳理论点 → 关键段落/金句摘录 → 简评（内容质量、适用人群）。
  关键流程/架构/对比关系用 mermaid 图（流程/结构 → `flowchart`，
  调用/交互 → `sequenceDiagram`），不用纯文字堆叠。
- **摘要 `summary.md`**（资讯、盘点、vlog 等看一遍就够）：开头一段话
  总述，其后按原顺序列要点，总长度约为转写的十分之一。
- **笔记 `notes.md`**（知识密集、适合快速学习和复习：课程、讲座、技术
  分享、how-to）：动笔前完整读取 [快速学习笔记规则](references/learning-notes.md)。
  默认面向有大学基础、尚无行业经验的读者，以“带着问题学习 + 费曼学习法”
  组织：带着具体问题读 → 用原因和例子讲明白 → 合上笔记讲给别人 →
  换个场景试一题、对照答案找卡点。术语随用随解释，表达简短但保留因果
  和适用条件。至少一张 mermaid 图（流程/判断 → `flowchart`，调用/交互
  → `sequenceDiagram`），帮助理解关键关系；并继续第 6 步。

操作（写作规则，每份都适用）：
- 动笔前完整读取 `transcript.md`；论断必须能在转写里找到对应内容，
  不臆造。
- 正文不嵌 `[unit-xxxxxx | 0.000–8.820s]` 转写标记——它只有逻辑编号、
  无物理跳转，无法直接追溯，反而妨碍阅读。
- 区分"视频里说的"与"Agent 补充的"，补充处标"注："。
- 简体中文，转写含繁体一并转换；用户指定其他语言除外。
- 转写过于稀疏（纯音乐、无有效语音）→ 说明情况并跳过加工。

验收：
- 各生成物结构齐全，写在转写同目录。
- `report.md`、`notes.md` 至少各一张 mermaid 图；`summary.md` 总长度
  约为转写的十分之一。
- `notes.md` 的开篇问题与正文讲解对应；费曼复述有明确任务和检查点；
  迁移练习在独立末节给出参考判断及理由（或实践任务的预期现象与自查依据），
  并指向卡点所在章节。其余学习与表达要求按快速学习笔记规则逐项回读。
- 逐条回读转写核实：所有论断有来源支撑；正文无 `[unit-…]` 标记、
  无繁体残留；补充处均有"注："。

### 第 6 步：思维导图 mindmap.html（笔记类型附带）

操作：
- 复制技能目录 `templates/mindmap-template.html` 为产物目录
  `mindmap.html`，把模板中 `{{在此写标题}}` 及其下方示例大纲替换为
  笔记大纲：根节点是主题，一级分支对应笔记的核心问题，二级分支放
  回答要点，最多三层，一节点一个短句；不收录复述任务、练习答案等
  辅助章节，其余保持模板原样。
- 浏览器打开即得可展开、折叠、缩放的交互式思维导图（联网加载
  markmap 库，离线打开仅显示提示）。

验收：
- `mindmap.html` 无 `{{在此写标题}}` 等占位残留。
- 大纲与 `notes.md` 的核心问题章节一致，只放骨架不塞细节，与 mermaid
  图互补不重复。

## 交付验收

- 产物齐备：`transcript.md` + `input.json` + 按判定生成的
  `report.md` / `summary.md` / `notes.md`（笔记附 `mindmap.html`），
  全部在转写同目录。
- 成稿可独立阅读，不对照 `transcript.md` 也能读懂。
- 回复用户：各类型得分与判定、产物路径、发现的转写质量问题
  （误识别、缺段等）。
