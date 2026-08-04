export class FetchError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "FetchError";
    this.status = status;
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new FetchError(`Timeout (${timeoutMs} ms): ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  const res = await fetchWithTimeout(url, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (!res.ok) throw new FetchError(`HTTP ${res.status}: ${url}`, res.status);
  return (await res.json()) as T;
}

export async function fetchText(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<string> {
  const res = await fetchWithTimeout(url, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (!res.ok) throw new FetchError(`HTTP ${res.status}: ${url}`, res.status);
  return res.text();
}
