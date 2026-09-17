/**
 * Serves a directory of video/audio clips from the dev server, for the Anki
 * card templates in anki/local-media/.
 *
 * Why this is not just a static file middleware: Anki's webview is Chromium,
 * and a media resource served without `Range`/`206 Partial Content` support is
 * treated as a non-seekable stream - `video.seekable` stays empty and every
 * assignment to `currentTime` is clamped back to 0. That silently breaks the
 * trimDurationStart seek in anki/local-media/front-template.html, even once the
 * clip is fully buffered. So this middleware implements `Range` itself.
 *
 * The clip directory lives outside the project (it holds multi-GB movie rips),
 * is configured with MEDIA_DIR, and is routinely absent on a machine that has
 * no clips yet - which must not stop the dev server from starting.
 */

import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import type { Connect, Plugin } from "vite";

// `bytes=<start>-<end>`, where either side may be omitted, e.g. `bytes=200-`
// (open ended) or `bytes=-500` (the final 500 bytes).
const RANGE_RE = /^bytes=(\d*)-(\d*)$/;

// Extensions the clip pipeline produces, mapped to what the webview needs to
// see to play them.
const CONTENT_TYPES: Record<string, string> = {
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".opus": "audio/opus",
  ".srt": "text/plain; charset=utf-8",
  ".wav": "audio/wav",
  ".webm": "video/webm",
};

const COPY_BLOCK_SIZE = 64 * 1024;

export interface ServeMediaOptions {
  /** URL prefix the clips are mounted under, e.g. "/local-media/". */
  urlPrefix: string;
  /** Directory of clips to serve. `~` is expanded. */
  directory: string;
}

/** Expands a leading `~` and makes the path absolute. */
export function resolveMediaDirectory(directory: string): string {
  const expanded =
    directory === "~" || directory.startsWith("~/")
      ? path.join(os.homedir(), directory.slice(1))
      : directory;
  return path.resolve(expanded);
}

class RangeNotSatisfiable extends Error {}

/** Resolves a `Range` header into an inclusive [start, end] byte offset pair. */
export function parseByteRange(
  rangeHeader: string,
  fileSize: number
): [number, number] {
  const match = RANGE_RE.exec(rangeHeader.trim());
  if (!match) {
    throw new RangeNotSatisfiable(`Unsupported Range header: ${rangeHeader}`);
  }

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) {
    throw new RangeNotSatisfiable(
      `Range header specifies no bytes: ${rangeHeader}`
    );
  }

  let start: number;
  let end: number;
  if (!rawStart) {
    // Suffix range: the last N bytes of the file.
    const length = Number(rawEnd);
    if (length === 0) {
      throw new RangeNotSatisfiable(
        `Range header requests zero bytes: ${rangeHeader}`
      );
    }
    start = Math.max(0, fileSize - length);
    end = fileSize - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Math.min(Number(rawEnd), fileSize - 1) : fileSize - 1;
  }

  if (start >= fileSize || start > end) {
    throw new RangeNotSatisfiable(
      `Range header outside 0-${fileSize - 1}: ${rangeHeader}`
    );
  }

  return [start, end];
}

function contentType(filePath: string): string {
  const known = CONTENT_TYPES[path.extname(filePath).toLowerCase()];
  return known ?? "application/octet-stream";
}

function sendError(
  res: ServerResponse,
  status: number,
  message: string,
  headers: Record<string, string> = {}
): void {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    ...headers,
  });
  res.end(`${message}\n`);
}

/**
 * Resolves a request path to a file inside `root`, or null when it escapes the
 * root (`..` segments, absolute paths, symlinks pointing outside). `root` is
 * expected to already be a real path, so that a symlinked clip directory is
 * not mistaken for an escape.
 */
function resolveWithinRoot(
  root: string,
  relativeUrlPath: string
): string | null {
  const decoded = decodeURIComponent(relativeUrlPath);
  if (decoded.includes("\0")) return null;

  const resolved = path.resolve(root, `.${path.posix.sep}${decoded}`);
  const real = fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved;
  if (real !== root && !real.startsWith(root + path.sep)) return null;
  return real;
}

function renderListing(
  root: string,
  urlPrefix: string,
  directory: string
): string {
  const relative = path.relative(root, directory);
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const items = entries
    .map((entry) => {
      const suffix = entry.isDirectory() ? "/" : "";
      const href =
        urlPrefix +
        [...relative.split(path.sep).filter(Boolean), entry.name]
          .map(encodeURIComponent)
          .join("/") +
        suffix;
      return `<li><a href="${href}">${entry.name}${suffix}</a></li>`;
    })
    .join("\n");
  return `<!doctype html><meta charset="utf-8"><title>${relative || "/"}</title><h1>${relative || "/"}</h1><ul>\n${items}\n</ul>`;
}

function serveFile(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string,
  stats: fs.Stats
): void {
  const baseHeaders: Record<string, string> = {
    "Content-Type": contentType(filePath),
    "Accept-Ranges": "bytes",
    // The card runs inside the Anki webview, which is a different origin.
    "Access-Control-Allow-Origin": "*",
    "Last-Modified": stats.mtime.toUTCString(),
  };

  const rangeHeader = req.headers.range;
  let start = 0;
  let end = stats.size - 1;
  let status = 200;

  if (rangeHeader !== undefined) {
    try {
      [start, end] = parseByteRange(rangeHeader, stats.size);
    } catch (error) {
      if (!(error instanceof RangeNotSatisfiable)) throw error;
      sendError(res, 416, error.message, {
        "Content-Range": `bytes */${stats.size}`,
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
      });
      return;
    }
    status = 206;
    baseHeaders["Content-Range"] = `bytes ${start}-${end}/${stats.size}`;
  }

  baseHeaders["Content-Length"] = String(stats.size === 0 ? 0 : end - start + 1);
  res.writeHead(status, baseHeaders);

  if (req.method === "HEAD" || stats.size === 0) {
    res.end();
    return;
  }

  const stream = fs.createReadStream(filePath, {
    start,
    end,
    highWaterMark: COPY_BLOCK_SIZE,
  });
  // A seek in the webview aborts the in-flight response; that is routine, not
  // a failure worth crashing the dev server over.
  res.on("close", () => stream.destroy());
  stream.on("error", () => res.destroy());
  stream.pipe(res);
}

export function serveMedia(options: ServeMediaOptions): Plugin {
  const root = resolveMediaDirectory(options.directory);
  const urlPrefix = options.urlPrefix.endsWith("/")
    ? options.urlPrefix
    : `${options.urlPrefix}/`;

  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url ?? "/";
    if (!url.startsWith(urlPrefix)) {
      next();
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendError(res, 405, `Method not allowed: ${req.method}`);
      return;
    }

    // A missing clip directory is expected on a machine with no clips yet, so
    // it degrades to 404s rather than stopping the dev server from starting.
    if (!fs.existsSync(root)) {
      sendError(
        res,
        404,
        `Media directory does not exist: ${root}\n` +
          `Set MEDIA_DIR to the directory holding the clips and restart the dev server.`
      );
      return;
    }

    // Resolved per request: the clip directory may be a symlink, and may be
    // created (or replaced) while the dev server is running.
    const realRoot = fs.realpathSync(root);
    const requestPath = url.slice(urlPrefix.length).split(/[?#]/)[0];
    const filePath = resolveWithinRoot(realRoot, requestPath);
    if (filePath === null) {
      sendError(res, 403, `Forbidden: ${requestPath}`);
      return;
    }

    let stats: fs.Stats;
    try {
      stats = fs.statSync(filePath);
    } catch {
      sendError(res, 404, `File not found: ${requestPath}`);
      return;
    }

    if (stats.isDirectory()) {
      if (!url.endsWith("/")) {
        res.writeHead(301, { Location: `${url}/` });
        res.end();
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(renderListing(realRoot, urlPrefix, filePath));
      return;
    }

    serveFile(req, res, filePath, stats);
  };

  return {
    name: "serve-media",
    apply: "serve",
    configureServer(server) {
      // Registered from configureServer itself (not from a returned post
      // hook), so it runs ahead of Vite's own middlewares - nothing else gets
      // to answer, or transform, a clip request.
      server.middlewares.use(handler);

      const exists = fs.existsSync(root);
      server.config.logger.info(
        `  ➜  Media:   ${urlPrefix} → ${root}${exists ? "" : "  (missing, requests will 404)"}`
      );
    },
  };
}
