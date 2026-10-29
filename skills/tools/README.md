# Tools

Skills wrapped around something concrete: a script, a file format, a service.

Every user-invoked skill here is reachable only when you type it: `/skill:<name>`.

## User-invoked

- **[ds-prompting](./ds-prompting/SKILL.md)**: DeepSeek 极限用量提示词的逐字存档，需要原样取用时调用。
- **[readme-crafter-skill](./readme-crafter-skill/SKILL.md)**: Write, rewrite, or audit a repository's `README.md` as a landing page and onboarding guide.
- **[unslop](./unslop/SKILL.md)**: Cut AI tells from any writing.
- **[video-transcribe](./video-transcribe/SKILL.md)**: Bilibili 视频或本地音频转成带时间戳的中文转写，并按内容生成阅读报告或笔记。
- **[voice-debrief](./voice-debrief/SKILL.md)**: 面试或会议录音转写复盘，可存飞书文档并归档到对应多维表格。

## Model-invoked

Model- or user-reachable, so a rich trigger description pays off.

- **[archify](./archify/SKILL.md)**: Render architecture, workflow, sequence, ERD and lifecycle diagrams plus one-page explainers as standalone HTML through a JSON-IR CLI.
- **[find-skills](./find-skills/SKILL.md)**: Discover and install skills from the open agent skills ecosystem.
- **[pandoc-docx-template](./pandoc-docx-template/SKILL.md)**: Markdown to DOCX (and back) with Pandoc, using the bundled Chinese Word templates and Lua filters.
- **[show-me](./show-me/SKILL.md)**: Explain the current topic visually with diagrams, code-shape sketches, and focused HTML artifacts.
