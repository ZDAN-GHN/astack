# Sources

`voice-debrief` is adapted from [realwooolf/voice-debrief](https://github.com/realwooolf/voice-debrief), pinned to commit `da801685073f0736aac787454b1410facc7d6b47` (2026-07-05, the repository HEAD at install time; no tags exist).

`SKILL.md` and `README.md` were copied byte for byte from that revision, then adapted for Pi per the install rules: only platform couplings that cannot work on Pi were changed. The upstream repository ships no `LICENSE` file; provenance is recorded here instead.

## Adaptation audit (Claude Code couplings removed)

All changes are limited to `SKILL.md` and `README.md`; every other line is byte-identical to upstream.

| # | Upstream coupling | Pi adaptation | Lines touched |
|---|---|---|---|
| 1 | Config paths `~/.claude/feishu_config.json` / `~/.claude/feishu_token.json` | `~/.config/voice-debrief/feishu_config.json` / `~/.config/voice-debrief/feishu_token.json` | SKILL.md: 99, 198, 275–276, 279, 534, 542, 696, 780, 869 |
| 2 | Bash tool param `run_in_background=True` (×2) | Shell-level backgrounding via `nohup … &` plus log polling, or the host's background-task mechanism | SKILL.md: 133, 167 |
| 3 | `Read` tool for PDF text extraction | Host PDF text extraction (`pdftotext`, `pypdf`, `mdimport -t -d2`); fallback asks for a `.txt` transcript | SKILL.md: 381 |
| 4 | `AskUserQuestion` tool (×2) | Plain numbered-option question in the reply | SKILL.md: 922, 926 |
| 5 | "Claude Code 不支持直接上传音频" note; "Claude 立即询问" / "阻塞 Claude"; README "for Claude Code" / "发给 Claude" | Vendor-neutral wording ("agent 终端", "agent") | SKILL.md: 12, 133(a), 167(a), README.md: 3, 5, 19 |

Everything else — the phase flow (audio → transcribe → merge → organize), mlx-whisper / faster-whisper transcription code, Feishu OAuth flow, docx block writers, bitable auto-creation and interview/meeting record logic, multi-round company naming rules, the debrief follow-up mode — is unchanged from upstream.

## Remaining runtime dependencies (platform-agnostic, from upstream)

The transcription stage needs `mlx-whisper` (Apple Silicon) or `faster-whisper` (other platforms) plus `ffmpeg`; the Feishu stage needs a one-time self-built Feishu app (configured in the config file above). Local-save mode needs nothing beyond Python. These are runtime prerequisites of the skill's domain, not agent-tool couplings.
