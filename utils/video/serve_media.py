#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Serve a directory of video/audio clips over HTTP for the Anki card templates.

Why not `python3 -m http.server`: that server ignores the `Range` header and
always replies `200` with the whole file. Chromium (which is what Anki's
webview is) treats a media resource from a server without range support as a
non-seekable stream - `video.seekable` stays empty and every assignment to
`currentTime` is clamped back to 0. That silently breaks the trimDurationStart
seek in anki/local-media/front-template.html, even once the clip is fully
buffered.

This server implements `Range`/`206 Partial Content` so clips stay seekable.

Usage:
    ./serve_media.py --directory "/path/to/clips"
    ./serve_media.py --directory "/path/to/clips" --port 8080
"""

from __future__ import annotations

import argparse
import os
import re
import socket
import socketserver
import sys
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import TYPE_CHECKING, AnyStr, BinaryIO

if TYPE_CHECKING:
    from _typeshed import SupportsRead, SupportsWrite

# `bytes=<start>-<end>`, where either side may be omitted, e.g. `bytes=200-`
# (open ended) or `bytes=-500` (the final 500 bytes).
RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")

# Extensions the clip pipeline produces that Python does not always map itself.
EXTRA_CONTENT_TYPES = {
    ".mkv": "video/x-matroska",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
}


class RangeRequestError(Exception):
    """A `Range` header that cannot be satisfied for the requested file."""

    def __init__(self, message: str, file_size: int) -> None:
        super().__init__(message)
        self.file_size = file_size


def parse_byte_range(range_header: str, file_size: int) -> tuple[int, int]:
    """Resolve a `Range` header into an inclusive (start, end) byte offset pair."""
    match = RANGE_RE.match(range_header.strip())
    if not match:
        raise RangeRequestError(f"Unsupported Range header: {range_header!r}", file_size)

    raw_start, raw_end = match.group(1), match.group(2)

    if not raw_start and not raw_end:
        raise RangeRequestError(f"Range header specifies no bytes: {range_header!r}", file_size)

    if not raw_start:
        # Suffix range: the last N bytes of the file.
        length = int(raw_end)
        if length == 0:
            raise RangeRequestError(f"Range header requests zero bytes: {range_header!r}", file_size)
        start = max(0, file_size - length)
        end = file_size - 1
    else:
        start = int(raw_start)
        end = int(raw_end) if raw_end else file_size - 1
        end = min(end, file_size - 1)

    if start >= file_size or start > end:
        raise RangeRequestError(f"Range header outside 0-{file_size - 1}: {range_header!r}", file_size)

    return start, end


class RangeRequestHandler(SimpleHTTPRequestHandler):
    """A static file handler that honours `Range` requests."""

    # How many bytes are pushed to the socket per write.
    copy_block_size = 64 * 1024

    # Bytes still owed to the client for the current ranged response, or None
    # when the whole file is being sent.
    range_remaining: int | None = None

    def guess_type(self, path: str | os.PathLike[str]) -> str:
        suffix = Path(path).suffix.lower()
        if suffix in EXTRA_CONTENT_TYPES:
            return EXTRA_CONTENT_TYPES[suffix]
        return super().guess_type(path)

    def end_headers(self) -> None:
        # The card runs from the Anki webview, which is a different origin.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def send_head(self) -> BinaryIO | None:
        range_header = self.headers.get("Range")
        if range_header is None:
            self.range_remaining = None
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path):
            # Directory listings are not range-able; let the base class answer.
            self.range_remaining = None
            return super().send_head()

        try:
            # Not a context manager: `send_head` hands the open stream to the
            # caller, which reads it via `copyfile` and closes it afterwards.
            stream = open(path, "rb")  # noqa: SIM115
        except OSError:
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return None

        try:
            file_size = os.fstat(stream.fileno()).st_size
            try:
                start, end = parse_byte_range(range_header, file_size)
            except RangeRequestError as error:
                self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                self.send_header("Content-Range", f"bytes */{error.file_size}")
                self.end_headers()
                self.log_message("%s", error)
                return None

            stream.seek(start)
            self.range_remaining = end - start + 1

            self.send_response(HTTPStatus.PARTIAL_CONTENT)
            self.send_header("Content-Type", self.guess_type(path))
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
            self.send_header("Content-Length", str(self.range_remaining))
            self.send_header("Last-Modified", self.date_time_string(int(os.fstat(stream.fileno()).st_mtime)))
            self.end_headers()
        except Exception:
            stream.close()
            raise

        return stream

    def copyfile(self, source: SupportsRead[AnyStr], outputfile: SupportsWrite[AnyStr]) -> None:
        remaining = self.range_remaining
        if remaining is None:
            super().copyfile(source, outputfile)
            return

        while remaining > 0:
            chunk = source.read(min(self.copy_block_size, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)


class DualStackServer(ThreadingHTTPServer):
    """Serves IPv6 and IPv4 clients, so both [::1] and 127.0.0.1 work."""

    address_family = socket.AF_INET6
    daemon_threads = True

    def server_bind(self) -> None:
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        socketserver.TCPServer.server_bind(self)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", type=int, default=8080, help="Port to listen on (default: 8080)")
    parser.add_argument(
        "--directory",
        type=Path,
        default=Path.cwd(),
        help="Directory of clips to serve (default: current directory)",
    )
    args = parser.parse_args()

    directory = args.directory.expanduser().resolve()
    if not directory.is_dir():
        raise NotADirectoryError(f"Not a directory: {directory}")

    handler = partial(RangeRequestHandler, directory=str(directory))
    with DualStackServer(("::", args.port), handler) as server:
        print(f"Serving {directory} with Range support on:")
        print(f"  http://[::1]:{args.port}/")
        print(f"  http://127.0.0.1:{args.port}/")
        print("Press Ctrl-C to stop.")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.", file=sys.stderr)


if __name__ == "__main__":
    main()
