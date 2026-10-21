#!/usr/bin/env python3
"""SiliconFlow 远程转写：音频 → 按静音分段 → 逐段调 API → SRT。仅用标准库。

SiliconFlow 免费托管阿里 FunAudioLLM 的 SenseVoiceSmall，但接口只返回
整段文本（无时间戳）。这里用 ffmpeg silencedetect 找静音边界，把语音
切成约 10–30 秒的小段，逐段调用 OpenAI 兼容的
/v1/audio/transcriptions，段边界即时间戳。输出 SRT 交给 format.py 整理。

API key 从环境变量 SILICONFLOW_API_KEY 读取（extract.sh 负责传入）。
"""

from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

TAG_RE = re.compile(r"<\|[^|]*\|>")  # SenseVoice 的 <|zh|><|NEUTRAL|> 等标签
RETRY_STATUS = {429, 500, 502, 503, 504}


def probe_duration(audio: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(audio)],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    return float(out)


def detect_silences(audio: Path, noise_db: float, min_dur: float) -> list[tuple[float, float]]:
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostdin", "-i", str(audio),
         "-af", f"silencedetect=noise={noise_db}dB:d={min_dur}", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    log = proc.stderr
    starts = [float(m) for m in re.findall(r"silence_start:\s*([0-9.]+)", log)]
    ends = [float(m) for m in re.findall(r"silence_end:\s*([0-9.]+)", log)]
    pairs: list[tuple[float, float]] = []
    for i, s in enumerate(starts):
        e = ends[i] if i < len(ends) else None
        if e is not None and e > s:
            pairs.append((s, e))
    return pairs


def speech_runs(total: float, silences: list[tuple[float, float]]) -> list[tuple[float, float]]:
    runs: list[tuple[float, float]] = []
    pos = 0.0
    for s, e in silences:
        if s > pos + 0.05:
            runs.append((pos, min(s, total)))
        pos = max(pos, e)
    if pos < total - 0.05:
        runs.append((pos, total))
    return [(s, e) for s, e in runs if e - s >= 0.25]


def chunkify(runs: list[tuple[float, float]], chunk_max: float) -> list[tuple[float, float]]:
    """贪心合并相邻语音段（≤chunk_max），超长连续语音均分拆开。"""
    merged: list[tuple[float, float]] = []
    cur: list[float] | None = None
    for s, e in runs:
        if cur is None:
            cur = [s, e]
        elif e - cur[0] <= chunk_max:
            cur[1] = e
        else:
            merged.append((cur[0], cur[1]))
            cur = [s, e]
    if cur:
        merged.append((cur[0], cur[1]))

    chunks: list[tuple[float, float]] = []
    for s, e in merged:
        if e - s > chunk_max * 1.5:
            n = math.ceil((e - s) / chunk_max)
            step = (e - s) / n
            chunks.extend((s + i * step, s + (i + 1) * step) for i in range(n))
        else:
            chunks.append((s, e))
    return chunks


def extract_chunk(audio: Path, out_wav: Path, start: float, end: float) -> None:
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
         "-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-i", str(audio),
         "-ac", "1", "-ar", "16000", str(out_wav)],
        check=True, capture_output=True, text=True,
    )


def transcribe(wav: Path, base_url: str, model: str, api_key: str,
               retries: int, timeout: float) -> str:
    boundary = "----sfasr" + uuid.uuid4().hex
    parts = [
        (f"--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\n{model}\r\n"
         ).encode(),
        (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
         f"filename=\"{wav.name}\"\r\nContent-Type: audio/wav\r\n\r\n"
         ).encode()
        + wav.read_bytes() + b"\r\n",
        f"--{boundary}--\r\n".encode(),
    ]
    req = urllib.request.Request(
        base_url.rstrip("/") + "/audio/transcriptions",
        data=b"".join(parts),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    delay = 2.0
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            return TAG_RE.sub("", data.get("text", "")).strip()
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", errors="replace")[:300]
            except Exception:
                pass
            if e.code in RETRY_STATUS and attempt < retries:
                print(f"   HTTP {e.code}，{delay:.0f}s 后重试：{body}", file=sys.stderr)
                time.sleep(delay)
                delay *= 2
                continue
            raise SystemExit(f"错误：转写请求失败 HTTP {e.code}：{body}")
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < retries:
                print(f"   网络错误（{e}），{delay:.0f}s 后重试", file=sys.stderr)
                time.sleep(delay)
                delay *= 2
                continue
            raise SystemExit(f"错误：无法连接 {base_url}：{e}")
    return ""


def srt_time(t: float) -> str:
    ms = int(round(t * 1000))
    h, rem = divmod(ms, 3600_000)
    m, rem = divmod(rem, 60_000)
    s, ms = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audio", type=Path, required=True, help="16kHz 单声道 wav")
    parser.add_argument("--out", type=Path, required=True, help="输出 SRT 路径")
    parser.add_argument("--base-url", default="https://api.siliconflow.cn/v1")
    parser.add_argument("--model", default="FunAudioLLM/SenseVoiceSmall")
    parser.add_argument("--api-key", default="", help="留空则读环境变量 SILICONFLOW_API_KEY")
    parser.add_argument("--chunk-max", type=float, default=30.0, help="单段最长秒数")
    parser.add_argument("--silence-db", type=float, default=-35.0, help="静音判定阈值 dB")
    parser.add_argument("--silence-dur", type=float, default=0.6, help="静音最短时长秒")
    parser.add_argument("--retries", type=int, default=3)
    args = parser.parse_args()

    import os
    api_key = args.api_key or os.environ.get("SILICONFLOW_API_KEY", "")
    if not api_key:
        print("错误：缺少 API key（--api-key 或环境变量 SILICONFLOW_API_KEY）", file=sys.stderr)
        return 1

    audio = args.audio
    if not audio.is_file():
        print(f"错误：音频不存在：{audio}", file=sys.stderr)
        return 1

    total = probe_duration(audio)
    silences = detect_silences(audio, args.silence_db, args.silence_dur)
    chunks = chunkify(speech_runs(total, silences), args.chunk_max)
    print(f">> 音频 {total:.1f}s，检测到 {len(silences)} 处静音，切为 {len(chunks)} 段",
          file=sys.stderr)

    cues: list[tuple[float, float, str]] = []
    with tempfile.TemporaryDirectory(prefix="sfasr-") as tmp:
        tmpdir = Path(tmp)
        for i, (start, end) in enumerate(chunks, 1):
            wav = tmpdir / f"chunk-{i:04d}.wav"
            extract_chunk(audio, wav, start, end)
            text = transcribe(wav, args.base_url, args.model, api_key,
                              args.retries, timeout=300.0).replace("\n", " ").strip()
            print(f"[{i}/{len(chunks)}] {srt_time(start)} → {len(text)} 字", file=sys.stderr)
            if text:
                cues.append((start, end, text))

    lines: list[str] = []
    for n, (start, end, text) in enumerate(cues, 1):
        lines.append(f"{n}\n{srt_time(start)} --> {srt_time(end)}\n{text}\n")
    args.out.write_text("\n".join(lines), encoding="utf-8")
    print(f">> 远程转写完成：{len(cues)} 段 → {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
