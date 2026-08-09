#!/usr/bin/env bash
#
# Make video files playable by VLC (and the native player) on iPhone/iPad.
#
# Two problems are handled:
#   1. Wrong container  -> the file is e.g. an MPEG-TS stream named "*.mp4".
#                          iOS refuses these. Fixed by a lossless REMUX
#                          (stream copy into a real MP4 + faststart).
#   2. Wrong codecs     -> video is not H.264 or audio is not AAC/MP3.
#                          Fixed by a real RE-ENCODE.
#
# Originals are moved into ./originals/ (unless --no-backup) so nothing is lost.
#
# Usage:
#   ./fix_for_vlc_ios.sh [options] [files or directories...]
#
# Options:
#   -n, --dry-run          Show what would be done, change nothing.
#   -f, --force-reencode   Re-encode everything, even if a remux would do.
#       --no-backup        Delete the original instead of moving it to originals/.
#       --crf N            x264 quality for re-encodes (default 20, lower = better).
#       --preset NAME      x264 preset for re-encodes (default medium).
#   -h, --help             Show this help.
#
# With no file arguments the current directory is scanned.

set -euo pipefail

DRY_RUN=0
FORCE_REENCODE=0
BACKUP=1
CRF=20
PRESET=medium

BACKUP_DIR_NAME="originals"
VIDEO_EXTENSIONS=(mp4 m4v mkv mov avi ts webm flv wmv mpg mpeg m2ts)

# Codecs iOS can decode in hardware / VLC handles without trouble.
COMPATIBLE_VIDEO_CODECS=(h264)
COMPATIBLE_AUDIO_CODECS=(aac mp3)
COMPATIBLE_PIX_FMTS=(yuv420p yuvj420p)
COMPATIBLE_CONTAINERS=(mov mp4 m4a 3gp 3g2 mj2)
MAX_H264_LEVEL=52   # 5.2; anything above is not safely decodable on older devices

die() { printf 'error: %s\n' "$*" >&2; exit 1; }
log() { printf '%s\n' "$*"; }

usage() {
    sed -n '3,29p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
}

contains() {
    local needle=$1; shift
    local item
    for item in "$@"; do
        [[ $item == "$needle" ]] && return 0
    done
    return 1
}

require_tools() {
    local tool
    for tool in ffmpeg ffprobe; do
        command -v "$tool" >/dev/null 2>&1 \
            || die "$tool not found. Install it with: brew install ffmpeg"
    done
}

# probe <file> <entries> -- echoes the requested ffprobe values, one per line.
probe() {
    local file=$1 stream_spec=$2 entries=$3
    ffprobe -v error -select_streams "$stream_spec" \
        -show_entries "$entries" -of default=noprint_wrappers=1:nokey=1 \
        "$file" 2>/dev/null | head -n 1
}

probe_format() {
    local file=$1 entry=$2
    ffprobe -v error -show_entries "format=$entry" \
        -of default=noprint_wrappers=1:nokey=1 "$file" 2>/dev/null | head -n 1
}

# Decide what to do with a file: prints "ok", "remux" or "reencode",
# followed by a human-readable reason.
classify() {
    local file=$1

    local container video_codec audio_codec pix_fmt level
    container=$(probe_format "$file" format_name)
    [[ -n $container ]] || die "cannot read '$file' (not a media file?)"

    video_codec=$(probe "$file" v:0 stream=codec_name)
    audio_codec=$(probe "$file" a:0 stream=codec_name)
    pix_fmt=$(probe "$file" v:0 stream=pix_fmt)
    level=$(probe "$file" v:0 stream=level)

    [[ -n $video_codec ]] || die "'$file' has no video stream"

    local reasons=()
    local need_reencode=0 need_remux=0

    if ! contains "$video_codec" "${COMPATIBLE_VIDEO_CODECS[@]}"; then
        reasons+=("video codec is $video_codec, not h264")
        need_reencode=1
    elif [[ -n $pix_fmt ]] && ! contains "$pix_fmt" "${COMPATIBLE_PIX_FMTS[@]}"; then
        reasons+=("pixel format is $pix_fmt, not 8-bit 4:2:0")
        need_reencode=1
    elif [[ $level =~ ^[0-9]+$ ]] && (( level > MAX_H264_LEVEL )); then
        reasons+=("H.264 level $level is above $MAX_H264_LEVEL")
        need_reencode=1
    fi

    if [[ -n $audio_codec ]] && ! contains "$audio_codec" "${COMPATIBLE_AUDIO_CODECS[@]}"; then
        reasons+=("audio codec is $audio_codec, not aac/mp3")
        need_reencode=1
    fi

    # format_name for MP4-family files is a comma separated list.
    local container_ok=0 name
    IFS=',' read -ra container_names <<< "$container"
    for name in "${container_names[@]}"; do
        if contains "$name" "${COMPATIBLE_CONTAINERS[@]}"; then
            container_ok=1
            break
        fi
    done
    if (( ! container_ok )); then
        reasons+=("container is $container, not mp4")
        need_remux=1
    fi

    if (( FORCE_REENCODE )); then
        printf 'reencode\t%s\n' "forced by --force-reencode"
    elif (( need_reencode )); then
        printf 'reencode\t%s\n' "$(IFS='; '; echo "${reasons[*]}")"
    elif (( need_remux )); then
        printf 'remux\t%s\n' "$(IFS='; '; echo "${reasons[*]}")"
    else
        printf 'ok\t%s\n' "already a compatible mp4 ($video_codec/${audio_codec:-no audio})"
    fi
}

# Verify the converted file has roughly the same duration as the source.
verify_output() {
    local source=$1 output=$2

    local source_duration output_duration
    source_duration=$(probe_format "$source" duration)
    output_duration=$(probe_format "$output" duration)

    if [[ -z $output_duration ]]; then
        printf 'error: converted file is unreadable\n' >&2
        return 1
    fi

    if [[ $source_duration =~ ^[0-9.]+$ && $output_duration =~ ^[0-9.]+$ ]]; then
        if ! awk -v a="$source_duration" -v b="$output_duration" \
            'BEGIN { d = a - b; if (d < 0) d = -d; exit !(d <= 2.0 || d <= a * 0.02) }'
        then
            printf 'error: duration mismatch: source %ss, output %ss\n' \
                "$source_duration" "$output_duration" >&2
            return 1
        fi
    fi
}

convert() {
    local source=$1 action=$2 output=$3

    # -map picks exactly one video and (if present) one audio stream, dropping
    # data/timed-metadata streams that MP4 cannot hold.
    local args=(
        -hide_banner -loglevel warning -stats -y
        -fflags +genpts
        -i "$source"
        -map 0:v:0 -map "0:a:0?"
        -movflags +faststart
        -avoid_negative_ts make_zero
    )

    if [[ $action == remux ]]; then
        args+=(-c copy)
    else
        args+=(
            -c:v libx264 -profile:v high -level:v 4.0 -pix_fmt yuv420p
            -crf "$CRF" -preset "$PRESET"
            -c:a aac -b:a 192k -ar 48000 -ac 2
        )
    fi

    ffmpeg "${args[@]}" "$output"
}

backup_original() {
    local source=$1 directory=$2

    if (( ! BACKUP )); then
        rm -f "$source"
        return
    fi

    local backup_dir="$directory/$BACKUP_DIR_NAME"
    mkdir -p "$backup_dir"
    mv "$source" "$backup_dir/$(basename "$source")"
}

process_file() {
    local source=$1

    local classification action reason
    classification=$(classify "$source")
    action=${classification%%$'\t'*}
    reason=${classification#*$'\t'}

    local name
    name=$(basename "$source")

    if [[ $action == ok ]]; then
        log "SKIP     $name -- $reason"
        return
    fi

    log "$(printf '%-8s' "$(echo "$action" | tr '[:lower:]' '[:upper:]')") $name -- $reason"

    if (( DRY_RUN )); then
        return
    fi

    local directory target temp
    directory=$(dirname "$source")
    target="$directory/${name%.*}.mp4"
    temp="$directory/.${name%.*}.converting.mp4"

    # Convert to a temporary file first, so a failure never destroys the source.
    if ! convert "$source" "$action" "$temp" || ! verify_output "$source" "$temp"; then
        rm -f "$temp"
        die "conversion failed for '$name'"
    fi

    backup_original "$source" "$directory"
    mv "$temp" "$target"

    log "         -> $(basename "$target")"
}

collect_files() {
    local target=$1

    if [[ -f $target ]]; then
        printf '%s\0' "$target"
        return
    fi

    [[ -d $target ]] || die "no such file or directory: $target"

    local find_args=(-maxdepth 1 -type f)
    local extension first=1
    find_args+=('(')
    for extension in "${VIDEO_EXTENSIONS[@]}"; do
        (( first )) || find_args+=(-o)
        find_args+=(-iname "*.$extension")
        first=0
    done
    find_args+=(')')

    find "$target" "${find_args[@]}" -print0 | sort -z
}

main() {
    local targets=()

    while (( $# )); do
        case $1 in
            -n|--dry-run)        DRY_RUN=1 ;;
            -f|--force-reencode) FORCE_REENCODE=1 ;;
            --no-backup)         BACKUP=0 ;;
            --crf)               CRF=${2:?--crf needs a value}; shift ;;
            --preset)            PRESET=${2:?--preset needs a value}; shift ;;
            -h|--help)           usage ;;
            -*)                  die "unknown option: $1" ;;
            *)                   targets+=("$1") ;;
        esac
        shift
    done

    require_tools

    (( ${#targets[@]} )) || targets=(".")

    local target file
    for target in "${targets[@]}"; do
        while IFS= read -r -d '' file; do
            # Never reprocess our own backups.
            [[ $file == */$BACKUP_DIR_NAME/* ]] && continue
            process_file "$file"
        done < <(collect_files "$target")
    done

    if (( DRY_RUN )); then
        log ""
        log "Dry run -- nothing was changed. Re-run without --dry-run to apply."
    fi
}

main "$@"
