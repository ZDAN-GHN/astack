#!/usr/bin/env bash
# Bilibili 链接 / 本地音频 → 带时间戳的转写文本（transcript.md + input.json）。
# 零 pip / venv 依赖：只需要 bash、curl、ffmpeg、python3（标准库）。
# 首次运行 --bootstrap 会把 yt-dlp 单文件二进制、whisper.cpp 预编译二进制
# 和所选模型下载到技能根目录 .tools/ 下；之后整个技能目录拷到任何有 ffmpeg 的
# Linux 机器即可直接使用。
#
# 用法：
#   ./scripts/extract.sh 'https://www.bilibili.com/video/BVxxxxxxxxxx'
#   ./scripts/extract.sh --audio 本地音频.m4a
#   ./scripts/extract.sh --bootstrap                # 只安装工具和默认模型，不转写
#
# 参数：
#   --out DIR      输出目录（默认 ./transcripts/<视频id|时间戳>）
#   --model NAME   转写模型，三种写法都收：
#                    别名    large-v3-turbo、large-v3-turbo-q5_0、large-v3、
#                            medium、small、base、tiny（含 .en 变体、-q5_0 等量化）
#                    本地路径 /path/to/ggml-*.bin
#                    下载地址 https://…/ggml-*.bin
#   --language LM  转写语言（默认 zh）
#   --threads N    CPU 线程数（默认 nproc）
#   --engine NAME  转写引擎：whisper-cpp（本地，默认）/ siliconflow（远程免费，
#                        托管阿里 FunAudioLLM/SenseVoiceSmall；需 API key）
#   --audio FILE   转写本地音频文件，跳过下载
#   --bootstrap    下载缺失的工具与模型后退出
#
# 持久配置：把技能根目录的 extract.conf.example 复制为同目录的 extract.conf 并按需修改。
# 优先级：命令行参数 > 环境变量（EXTRACT_MODEL、SILICONFLOW_API_KEY 等）> extract.conf > 默认值。

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SKILL_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
TOOLS="$SKILL_DIR/.tools"
MODELS="$TOOLS/models"
DEFAULT_MODEL=large-v3-turbo
# 固定到已验证的 whisper.cpp 预编译发布（b5454）；可用 EXTRACT_WHISPER_URL 或 conf 覆盖
DEFAULT_WHISPER_TARBALL="https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-ubuntu-x64.tar.gz"

fail() { echo "错误：$*" >&2; exit 1; }
usage() { awk 'NR>1 && /^set -euo/ {exit} NR>1 {sub(/^# ?/, ""); print}' "$0"; }

MODEL="" LANGUAGE="" THREADS="" ENGINE="" OUT="" SOURCE="" AUDIO="" BOOTSTRAP=0
WHISPER_URL=""
# 环境变量先存一份：conf 里的同名变量不应覆盖环境变量（环境变量优先）
ENV_SILICONFLOW_KEY=${SILICONFLOW_API_KEY:-}
ENV_SILICONFLOW_BASE=${SILICONFLOW_BASE_URL:-}
ENV_SILICONFLOW_MODEL=${SILICONFLOW_MODEL:-}
if [ -f "$SKILL_DIR/extract.conf" ]; then . "$SKILL_DIR/extract.conf"; fi
MODEL=${EXTRACT_MODEL:-${MODEL:-}}
LANGUAGE=${EXTRACT_LANGUAGE:-${LANGUAGE:-}}
THREADS=${EXTRACT_THREADS:-${THREADS:-}}
ENGINE=${EXTRACT_ENGINE:-${ENGINE:-}}
WHISPER_URL=${EXTRACT_WHISPER_URL:-${WHISPER_URL:-}}

while [ $# -gt 0 ]; do
    case $1 in
        --out) OUT=${2:?"$1 需要参数"}; shift 2 ;;
        --model) MODEL=${2:?"$1 需要参数"}; shift 2 ;;
        --language) LANGUAGE=${2:?"$1 需要参数"}; shift 2 ;;
        --threads) THREADS=${2:?"$1 需要参数"}; shift 2 ;;
        --engine) ENGINE=${2:?"$1 需要参数"}; shift 2 ;;
        --audio) AUDIO=${2:?"$1 需要参数"}; shift 2 ;;
        --bootstrap) BOOTSTRAP=1; shift ;;
        -h|--help) usage; exit 0 ;;
        --*) fail "未知参数：$1（看 --help）" ;;
        *) [ -z "${SOURCE:-}" ] || fail "多余的位置参数：$1"; SOURCE=$1; shift ;;
    esac
done

MODEL=${MODEL:-$DEFAULT_MODEL}
LANGUAGE=${LANGUAGE:-zh}
THREADS=${THREADS:-$(nproc 2>/dev/null || echo 4)}
ENGINE=${ENGINE:-whisper-cpp}
case "$ENGINE" in
    whisper-cpp) ;;
    siliconflow) ;;
    *) fail "未知引擎：$ENGINE（可选 whisper-cpp 本地 / siliconflow 远程）" ;;
esac
# 远程引擎配置：环境变量 > conf > 默认（SiliconFlow 免费托管 SenseVoiceSmall）
SF_API_KEY=${ENV_SILICONFLOW_KEY:-${SILICONFLOW_API_KEY:-}}
SF_BASE_URL=${ENV_SILICONFLOW_BASE:-${SILICONFLOW_BASE_URL:-https://api.siliconflow.cn/v1}}
SF_MODEL=${ENV_SILICONFLOW_MODEL:-${SILICONFLOW_MODEL:-FunAudioLLM/SenseVoiceSmall}}

command -v python3 >/dev/null || fail "需要 python3"
command -v curl >/dev/null || fail "需要 curl"
command -v ffmpeg >/dev/null || fail "需要 ffmpeg 且在 PATH 上"

download() {
    local url=$1 dest=$2
    mkdir -p "$(dirname "$dest")"
    echo ">> 下载 $(basename "$dest")" >&2
    if curl -fL --connect-timeout 15 --retry 3 --retry-delay 2 -C - -o "$dest.part" "$url"; then
        mv "$dest.part" "$dest"
        return 0
    fi
    # huggingface.co 失败时自动改走国内镜像，并绕过环境代理（hf-mirror 在国内可直连）
    case "$url" in
        https://huggingface.co/*)
            echo ">> 直连失败，改走 hf-mirror.com" >&2
            local mirror="https://hf-mirror.com/${url#https://huggingface.co/}"
            if curl -fL --connect-timeout 15 --retry 3 --retry-delay 2 -C - --noproxy '*' -o "$dest.part" "$mirror"; then
                mv "$dest.part" "$dest"
                return 0
            fi
            ;;
    esac
    rm -f "$dest.part"
    fail "下载失败：$url（GitHub/HF 慢时可先 export https_proxy=... 再重试）"
}

resolve_model() {
    local m="$1" file url
    if [ -f "$m" ]; then echo "$m"; return 0; fi
    case "$m" in
        http*) file="$MODELS/$(basename "$m")"; [ -f "$file" ] || download "$m" "$file" ;;
        *)
            # whisper.cpp 官方模型集中在单个仓库（含量化变体）
            file="$MODELS/ggml-$m.bin"
            if [ ! -f "$file" ]; then
                url="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$m.bin"
                download "$url" "$file" \
                    || fail "模型下载失败（确认别名，如 large-v3-turbo、large-v3-turbo-q5_0、small、base、tiny）"
            fi
            ;;
    esac
    echo "$file"
}

find_ytdlp() {
    [ -x "$TOOLS/yt-dlp" ] && { echo "$TOOLS/yt-dlp"; return 0; }
    command -v yt-dlp >/dev/null 2>&1 && { command -v yt-dlp; return 0; }
    return 1
}

whisper_works() {
    [ -x "$1" ] || return 1
    LD_LIBRARY_PATH="$(dirname "$1")${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" \
        "$1" --help >/dev/null 2>&1
}

find_whisper() {
    # 找到的二进制必须真的能跑（新版发布里的 main 只是弃用提示桩，会直接退出）
    local c
    while IFS= read -r c; do
        whisper_works "$c" && { echo "$c"; return 0; }
    done < <(find "$TOOLS" -maxdepth 3 -type f \( -name whisper-cli -o -name main \) | sort)
    command -v whisper-cli >/dev/null 2>&1 && { command -v whisper-cli; return 0; }
    return 1
}


bootstrap_tools() {
    mkdir -p "$TOOLS" "$MODELS"
    if [ ! -x "$TOOLS/yt-dlp" ]; then
        # 官方 zipapp（约 3MB，用系统 python3 运行）；PyInstaller 版 38MB 太大不划算
        download "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" "$TOOLS/yt-dlp"
        chmod +x "$TOOLS/yt-dlp"
    fi
    if ! find_whisper >/dev/null; then
        local tgz
        tgz="$TOOLS/whisper-bin.tar.gz"
        download "${WHISPER_URL:-$DEFAULT_WHISPER_TARBALL}" "$tgz"
        tar -xzf "$tgz" -C "$TOOLS"
        rm -f "$tgz"
        find_whisper >/dev/null || fail "解压后未找到可用的 whisper 可执行文件"
    fi
}

if [ "$BOOTSTRAP" = 1 ]; then
    bootstrap_tools
    if [ "$ENGINE" = "siliconflow" ]; then
        echo ">> bootstrap 完成：远程引擎无需本地模型（$SF_MODEL）"
    else
        MODEL_FILE=$(resolve_model "$MODEL")
        echo ">> bootstrap 完成：工具与模型就绪（$MODEL_FILE）"
    fi
    exit 0
fi

if [ -n "$AUDIO" ]; then
    [ -f "$AUDIO" ] || fail "音频文件不存在：$AUDIO"
    [ -z "${SOURCE:-}" ] || fail "--audio 与链接二选一"
    media=$(cd "$(dirname "$AUDIO")" && pwd)/$(basename "$AUDIO")
    info=""
else
    [ -n "${SOURCE:-}" ] || fail "需要一个 Bilibili 链接或 --audio 文件（看 --help）"
    printf %s "$SOURCE" | grep -qi "bilibili.com" || fail "只支持 Bilibili 链接；本地文件请用 --audio"
    YTDLP=$(find_ytdlp) || fail "缺少 yt-dlp：先运行 ./extract.sh --bootstrap"
    if [ -z "$OUT" ]; then
        OUT="./transcripts/$(printf %s "$SOURCE" | grep -oE '(BV|av)[0-9A-Za-z]+' | head -n 1)"
        # 多 P（分集）视频把分 P 号带进目录名，避免同一 BV 的不同分集互相覆盖
        part=$(printf %s "$SOURCE" | grep -oE '[?&]p=[0-9]+' | head -n 1 | grep -oE '[0-9]+' || true)
        [ -n "$part" ] && OUT="$OUT-p$part"
        OUT="${OUT:-./transcripts/$(date +%Y%m%d-%H%M%S)}"
    fi
    mkdir -p "$OUT"
    media=""
    if [ -s "$OUT/source.info.json" ]; then
        media=$(find "$OUT" -maxdepth 1 -type f -name 'source.*' ! -name 'source.info.json' 2>/dev/null | head -n 1 || true)
    fi
    if [ -n "$media" ] && [ -f "$media" ]; then
        echo ">> 复用已下载音频：$media"
        info="$OUT/source.info.json"
    else
        echo ">> 下载音频"
        media=$("$YTDLP" --no-playlist -f bestaudio --no-warnings \
            -o "$OUT/source.%(ext)s" --write-info-json --print after_move:filepath "$SOURCE" \
            | tail -n 1) || fail "下载失败（play info / 412 多为 B 站限流，稍后重试）"
        [ -n "$media" ] && [ -f "$media" ] || fail "下载失败（play info / 412 多为 B 站限流，稍后重试）"
        info="$OUT/source.info.json"
    fi
fi

if [ -z "$OUT" ]; then
    OUT="./transcripts/$(date +%Y%m%d-%H%M%S)"
fi
mkdir -p "$OUT"
OUT=$(cd "$OUT" && pwd)

if [ "$ENGINE" = "siliconflow" ]; then
    [ -n "$SF_API_KEY" ] || fail "siliconflow 引擎需要 API key：cloud.siliconflow.cn/account/ak 免费创建，配置在环境变量 SILICONFLOW_API_KEY 或 extract.conf 的 SILICONFLOW_API_KEY="
    MODEL="$SF_MODEL"
else
    WHISPER=$(find_whisper) || fail "缺少 whisper.cpp 可执行文件：先运行 ./extract.sh --bootstrap"
    MODEL_FILE=$(resolve_model "$MODEL")
    # 预编译二进制与其同目录的动态库（libwhisper/libggml）一起工作
    export LD_LIBRARY_PATH="$(dirname "$WHISPER")${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

echo ">> 提取 16kHz 单声道音频"
ffmpeg -hide_banner -loglevel error -nostdin -y -i "$media" -vn -ac 1 -ar 16000 "$OUT/audio.wav"

if [ "$ENGINE" = "siliconflow" ]; then
    echo ">> 远程转写（SiliconFlow $SF_MODEL，静音分段后逐段调用）"
    SILICONFLOW_API_KEY="$SF_API_KEY" python3 "$SCRIPT_DIR/remote_asr.py" \
        --audio "$OUT/audio.wav" --out "$OUT/whisper.srt" \
        --base-url "$SF_BASE_URL" --model "$SF_MODEL"
else
    echo ">> 转写（模型 $MODEL，语言 $LANGUAGE，线程 $THREADS）"
    "$WHISPER" -m "$MODEL_FILE" -f "$OUT/audio.wav" -l "$LANGUAGE" -t "$THREADS" -osrt -of "$OUT/whisper" -pp
fi
srt="$OUT/whisper.srt"
[ -f "$srt" ] || fail "转写输出缺失：$srt（用 --help 核对当前二进制的输出参数）"

fmt=(--srt "$srt" --out "$OUT" --model "$MODEL" --language "$LANGUAGE" --engine "$ENGINE")
[ -n "$info" ] && [ -f "$info" ] && fmt+=(--info "$info")
[ -n "${SOURCE:-}" ] && fmt+=(--url "$SOURCE")
python3 "$SCRIPT_DIR/format.py" "${fmt[@]}"
rm -f "$OUT/audio.wav"

echo
# "完成"的目录是转写产物；报告/摘要/笔记由 Agent 读取后按 SKILL.md 生成
echo "完成：$OUT/transcript.md"
echo "默认下一步：基于转写生成阅读报告/摘要/笔记（类型判定规则见 SKILL.md）。"
