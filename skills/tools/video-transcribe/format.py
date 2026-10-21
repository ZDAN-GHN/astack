#!/usr/bin/env python3
"""把 whisper.cpp 的 SRT 输出整理成带时间戳的转写文本。仅用标准库。

输出两个文件：
  transcript.md  标题（可选）+ [unit-000001 | 0.000–8.820s] 正文行
  input.json     标题、作者、简介、时长、链接与转写配置元数据
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


def _ms(stamp: str) -> int:
    h, m, rest = stamp.split(":")
    s, ms = re.split("[,.]", rest)
    return ((int(h) * 60 + int(m)) * 60 + int(s)) * 1000 + int(ms)


def parse_srt(path: Path) -> list[tuple[int, int, str]]:
    segments: list[tuple[int, int, str]] = []
    start: int | None = None
    end: int | None = None
    lines: list[str] = []
    new_block = True

    def flush() -> None:
        nonlocal start, end, lines, new_block
        if start is not None and end is not None:
            text = " ".join(part for part in (ln.strip() for ln in lines) if part)
            if text and end > start:
                segments.append((start, end, text))
        start = end = None
        lines = []
        new_block = True

    for raw in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
        line = raw.strip()
        if "-->" in line:
            flush()
            new_block = False
            left, _, right = line.partition("-->")
            start = _ms(left.strip())
            end = _ms(right.split()[0].strip())
        elif not line:
            flush()
        else:
            if new_block and line.isdigit():
                continue
            new_block = False
            lines.append(line)
    flush()
    return segments


def _stamp(ms: int) -> str:
    return f"{ms / 1000:.3f}"


def _simplify(text: str) -> str:
    """Whisper 的中文输出常为繁体或繁简混合；装了 opencc 模块就顺手转简体，没装则原文保留。"""
    try:
        from opencc import OpenCC
    except ImportError:
        return text
    if "cc" not in _simplify.__dict__:
        _simplify.cc = OpenCC("t2s")
    return _simplify.cc.convert(text)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--srt", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--info", type=Path, help="yt-dlp 的 source.info.json（可选）")
    parser.add_argument("--url", help="来源链接（可选）")
    parser.add_argument("--model", required=True)
    parser.add_argument("--language", required=True)
    parser.add_argument("--engine", required=True)
    args = parser.parse_args()

    info: dict = {}
    if args.info and args.info.is_file():
        try:
            info = json.loads(args.info.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            info = {}

    segments = parse_srt(args.srt)
    if not segments:
        print("错误：SRT 中没有有效转写段", file=sys.stderr)
        return 1

    title = info.get("title")
    uploader = info.get("uploader") or info.get("channel")
    url = args.url or info.get("webpage_url")

    lines: list[str] = []
    if title:
        lines.append(f"# {title}")
        if url:
            parts = ["Bilibili", uploader or "", f"《{title}》", url]
            lines.append("；".join(part for part in parts if part))
        lines.append("")
    for ordinal, (start, end, text) in enumerate(segments, 1):
        text = _simplify(text)
        lines.append(f"[unit-{ordinal:06d} | {_stamp(start)}–{_stamp(end)}s] {text}")

    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "transcript.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    meta: dict = {
        "title": title,
        "uploader": uploader,
        "description": info.get("description"),
        "duration_s": info.get("duration"),
        "url": url,
        "asr": {"engine": args.engine, "model": args.model, "language": args.language},
    }
    if not args.info:
        meta["note"] = "本地音频转写，无来源元数据"
    (args.out / "input.json").write_text(
        json.dumps({k: v for k, v in meta.items() if v is not None}, ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )
    print(f">> 整理完成：{len(segments)} 个转写单元 → {args.out / 'transcript.md'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
