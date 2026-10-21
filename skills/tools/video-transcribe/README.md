# video-transcribe

把一段 B 站视频或本地音频变成带时间戳的转写文本（`transcript.md` +
`input.json`），之后由 Agent 按需生成阅读报告、摘要或笔记（规则见
SKILL.md）。

本文件是面向人的用法说明：安装、引擎配置、参数与疑难排查。
Agent 的工作流程与产物约定见 SKILL.md。目录结构：脚本在 `scripts/`，
思维导图模板在 `templates/`，配置模板 `extract.conf.example` 与工具模型
缓存 `.tools/` 在技能根目录。

## 先决条件

bash、curl、ffmpeg（PATH 上）、python3（标准库即可，无需 pip）。

## 转写引擎

| 引擎 | 位置 | 模型 | 说明 |
|---|---|---|---|
| `siliconflow` | 远程 | FunAudioLLM/SenseVoiceSmall | 免费托管阿里 FunAudioLLM 的 SenseVoice，中文准确、速度快、不吃本机 CPU/内存。**低配机器推荐** |
| `whisper-cpp` | 本地 | large-v3-turbo 等 | 离线可用，首次需下载模型（large-v3-turbo 约 1.6 GB） |

### siliconflow（远程，推荐）

1. 到 <https://cloud.siliconflow.cn/account/ak> 免费注册并创建 API key；
2. 把技能根目录的 `extract.conf.example` 复制为 `extract.conf`，写入：

   ```sh
   ENGINE=siliconflow
   SILICONFLOW_API_KEY=sk-你的key
   ```

   也可用环境变量 `SILICONFLOW_API_KEY` 传入（优先级高于 conf）。

说明：SiliconFlow 的转写接口只返回整段文本（无时间戳），脚本用 ffmpeg
静音检测把音频切成约 10–30 秒的语音段，逐段调用
`/v1/audio/transcriptions`（OpenAI 兼容），段边界即时间戳——比 whisper
的句级略粗，但足够定位引用。

### whisper-cpp（本地，离线可用）

首次使用先 bootstrap（下载 yt-dlp、whisper.cpp 预编译二进制和模型到技能
根目录 `.tools/`）：

```sh
cd ~/.agents/skills/video-transcribe
./scripts/extract.sh --bootstrap          # 默认模型 large-v3-turbo（约 1.6 GB）
```

模型选择：`tiny/base` 仅适合快速验证链路，中文质量差；实际使用建议
`large-v3-turbo`（默认），要更快可用 `large-v3-turbo-q5_0` 或 `small`。

注意：16GB 内存的机器（尤其还开着开发环境时）慎用本地引擎：
large-v3-turbo 转写约 1.8GB 内存、CPU 满载半小时起步，容易撞 OOM，
请改用 siliconflow 远程引擎。

## 快速开始

B 站视频（在任意工作目录）：

```sh
~/.agents/skills/video-transcribe/scripts/extract.sh 'https://www.bilibili.com/video/BVxxxxxxxxxx'
# 输出：./transcripts/<视频id>/transcript.md + input.json（附原始音频 source.*）
```

本地音频：

```sh
~/.agents/skills/video-transcribe/scripts/extract.sh --audio 录音.m4a --out 输出目录
```

在 shell 里手动运行只完成转写；阅读报告/摘要/笔记是 Agent 读取产物后
的默认后续动作（见 SKILL.md"转写之后"一节）。

产物目录里已有 `source.info.json` + `source.*` 时，重跑会复用已下载音频，
不重新下载（换引擎重试不会再次触发 B 站限流）。

## 参数

常用参数（`--help` 看全）：

| 参数 | 说明 | 默认 |
|---|---|---|
| `--engine` | 转写引擎：`whisper-cpp`（本地）/ `siliconflow`（远程免费） | `whisper-cpp`（conf 可改） |
| `--model` | 别名（large-v3-turbo / -q5_0 / large-v3 / small / base / tiny…）、本地 `.bin` 路径或下载 URL；siliconflow 引擎固定用 SenseVoiceSmall | `large-v3-turbo` |
| `--language` | 转写语言 | `zh` |
| `--threads` | CPU 线程数 | `nproc` |
| `--out` | 输出目录 | `./transcripts/<视频id或时间戳>` |

## 持久配置

把技能根目录的 `extract.conf.example` 复制为 `extract.conf` 修改（含密钥，已
gitignore）。优先级：命令行 > 环境变量（`EXTRACT_MODEL`、
`SILICONFLOW_API_KEY` 等）> conf > 默认值。

## 疑难排查

- **B 站下载偶发 `Failed to extract play info` / HTTP 412**：限流，
  稍等重跑；已下载的音频会被复用。
- **siliconflow 报 401**：API key 未配置或失效；报 429：触发限流，
  脚本会自动退避重试，持续 429 则稍后再跑。
- **首次运行本地模型从 Hugging Face 下载权重**（`-q5_0` 量化版约
  500 MB，fp16 版约 1.6 GB，tiny 约 75 MB），之后复用缓存；HF 直连
  失败时自动改走 hf-mirror.com。GitHub 慢时可先 `export https_proxy=...`。
- **Whisper 的中文输出可能为繁体或繁简混合**：python 环境装有 opencc
  模块（如 `pip install opencc-python-reimplemented`）时 format.py 自动
  转简体，没装则保留原文，由后续 Agent 自行处理。
- **本地转写速度**：取决于模型与 CPU——12 核笔记本上 tiny 约 10 倍实时
  （仅适合验证），large-v3-turbo 约 1.2 倍实时（4 分 16 秒音频约 3.5 分钟
  转完）。专有名词可能有同音误识别。要更快换远程引擎或
  `large-v3-turbo-q5_0` / `small`。
- **平台支持**：本地 whisper.cpp 为预编译二进制（Linux x86_64），
  macOS/Windows 需自行编译 whisper.cpp 后放 PATH，或直接用 siliconflow
  远程引擎（任何能访问 API 的平台可用）。bootstrap 依赖 GitHub 与
  Hugging Face（或镜像）可达；全部产物缓存在技能根目录 `.tools/`，整个技能
  目录拷走即可离线使用。
