---
name: video-transcribe
description: 把 Bilibili 视频或本地音频转成带时间戳的中文转写文本（transcript.md + input.json），并默认基于转写生成阅读报告、摘要或笔记：用户指定类型时从其指定，未指定时按内容给三种类型打匹配度，80 分以上的全部生成。零 pip 依赖，支持 SiliconFlow 远程免费转写（阿里 FunAudioLLM/SenseVoiceSmall）与 whisper.cpp 本地转写，引擎可配置；也可直接在 shell 里运行 extract.sh。
disable-model-invocation: true
---

# video-transcribe：视频/音频 → 转写 → 报告/摘要/笔记

把一段 B 站视频或本地音频变成带时间戳的转写文本，然后默认基于转写生成
阅读报告、摘要或笔记：用户指定类型时从其指定；未指定时根据视频内容
判定各类型匹配度，多个高匹配（≥80 分）的类型同时生成。只要转写不要
加工时，产物（transcript.md + input.json）也可以直接交给任何 Agent
（或人）继续处理。

## 何时用

- 用户给出 B 站链接，想要文字稿，或想要阅读报告、摘要、笔记；
- 用户给本地音频/视频文件，想要转写；
- 需要带时间戳转写文本作为输入的其他任务（检索、归档、翻译等）。

## 用法

```sh
~/.agents/skills/video-transcribe/extract.sh 'https://www.bilibili.com/video/BVxxxxxxxxxx'
# 输出：./transcripts/<视频id>/transcript.md + input.json（附原始音频 source.*）

~/.agents/skills/video-transcribe/extract.sh --audio 录音.m4a --out 输出目录   # 本地音频
```

两种转写引擎：`siliconflow`（远程免费，SiliconFlow 托管阿里
FunAudioLLM/SenseVoiceSmall，低配机器推荐）与 `whisper-cpp`（本地离线）。
默认 whisper-cpp，在 extract.conf 里设 `ENGINE=siliconflow` +
`SILICONFLOW_API_KEY=` 即可切换。安装、引擎配置、参数与疑难排查见
同目录 README.md。

## 产物

- `transcript.md`：`[unit-000001 | 0.000–8.820s] 正文` 逐段带时间戳；
  首两行为标题与来源（Bilibili；UP主；《标题》；链接），本地音频时省略。
- `input.json`：标题、UP主、简介、时长、链接、转写引擎与模型配置。
- `source.*` / `source.info.json`：原始音频与元数据，便于复用。
- 多 P（分集）视频：URL 带 `?p=N` 时输出目录名会带 `-pN`，同一 BV 的不同分集互不覆盖。

空段与时长为零的段落自动丢弃，编号连续。

## 转写之后：默认生成阅读报告 / 摘要 / 笔记

extract.sh 跑完、产物在手后，默认继续这一步（用户明确"只要转写"时
跳过）。加工产物写在转写同目录。

### 类型怎么定

1. 用户指定了类型（阅读报告 / 摘要 / 笔记）→ 只生成指定的；
2. 未指定 → 通读 transcript.md（结合 input.json 的标题与简介），给三种
   类型各打一个 0–100 的内容匹配度，**所有 ≥80 分的类型全部生成**；
   都不足 80 时只生成得分最高的一个。完成后在回复里简述各类型得分
   与判定理由。

### 三种类型

- **阅读报告 `report.md`**：适合有完整叙事或论证、值得细读的内容——
  教程、深度讲解、访谈、纪录片、演讲。结构：元信息（标题、UP主、时长、
  链接）→ 内容概览 → 按主题分节梳理论点 → 关键段落/金句摘录 → 简评
  （内容质量、适用人群）。关键流程、架构、对比关系用 mermaid 图呈现
  （流程/结构 → `flowchart`，调用/交互 → `sequenceDiagram`），
  不用纯文字堆叠。
- **摘要 `summary.md`**：适合资讯、盘点、vlog 等时间线推进、看一遍就够
  的内容。开头一段话总述，其后按原顺序列要点，总长度约为转写的十分之一。
- **笔记 `notes.md`**：适合知识密集、值得留档复习的内容——课程、讲座、
  技术分享、how-to。结构：概念/术语表 → 分主题要点 → 步骤/命令/配置等
  可操作信息 → 行动项或待查问题。必须包含至少一张 mermaid 图示
  （知识结构 → `mindmap` 或 `flowchart`，流程 → `flowchart`，
  调用链 → `sequenceDiagram`），并附带交互式思维导图
  `mindmap.html`（做法见下一节）。

### 通用规则

- 动笔前必须完整读取 `transcript.md`；关键论点、定义、步骤与摘录必须带
  `[unit-xxxxxx | 0.000–8.820s]` 引用（写到哪段引到哪段），没有对应
  来源单元的论断不写。成稿自检：正文零引用即不合格，回读转写补齐后重写。
- 忠实原文：区分"视频里说的"与"Agent 补充的"，补充处标"注："。
- 产物用简体中文（转写含繁体时一并转换）；用户指定其他语言除外。
- 转写内容过于稀疏（纯音乐、无有效语音）时，说明情况并跳过加工。

### 思维导图 mindmap.html（笔记类型附带）

- 复制本技能目录的 `mindmap-template.html` 为产物目录下的 `mindmap.html`，
  把模板中 `{{在此写标题}}` 及其下方示例大纲替换为笔记大纲：根节点是主题，
  一级分支对应笔记的主题章节，二级分支放要点，最多三层，一节点一个短句，
  其余部分保持模板原样。
- 浏览器打开即得可展开、折叠、缩放的交互式思维导图；需要联网加载
  markmap 库，离线打开会显示提示（详细内容仍看 notes.md）。
- 大纲与 notes.md 主题结构一致，只放骨架不塞细节；mermaid 图示承担
  流程与结构表达，两者互补不重复。

## 注意

- B 站下载偶发 `Failed to extract play info` / HTTP 412：是限流，稍等重跑；
  已下载音频会被复用。
- 其余安装、配置、模型选择与疑难排查见同目录 README.md。
