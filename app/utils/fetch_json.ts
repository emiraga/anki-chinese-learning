/**
 * Fetches a static JSON file (e.g. from public/data) and parses it.
 *
 * `cache: "no-store"` bypasses the browser HTTP cache. The Vite dev server
 * sends these files with `Cache-Control: no-cache` and a weak ETag, so every
 * page load revalidates them and gets a 304 answered from the browser cache.
 * Firefox occasionally answers such a revalidation with an empty body, which
 * surfaced as random "JSON.parse: unexpected end of data" errors. The files
 * are local, so skipping the cache costs nothing noticeable.
 *
 * The body is read as text first, so a bad response fails with an error that
 * names the URL and status instead of a bare JSON.parse message.
 */
export async function fetchJson<T>(url: string): Promise<T> {
  const result = await fetchJsonOrNull<T>(url);
  if (result === null) {
    throw new Error(`Failed to load "${url}": 404 Not Found`);
  }
  return result;
}

/**
 * Like fetchJson, but returns null when the file does not exist (HTTP 404),
 * for data sources that only cover some characters. Any other failure throws.
 */
export async function fetchJsonOrNull<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(
      `Failed to load "${url}": ${res.status} ${res.statusText}`,
    );
  }
  const text = await res.text();
  if (text.length === 0) {
    throw new Error(`Empty response body for "${url}" (HTTP ${res.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(
      `Invalid JSON in "${url}" (HTTP ${res.status}, ${text.length} chars): ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
}
