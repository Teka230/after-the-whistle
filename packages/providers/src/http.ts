const DEFAULT_DELAY_MS = 1200;
let lastFetchAt = 0;

export async function rateLimitedFetch(
  url: string,
  init?: RequestInit,
  minDelayMs = DEFAULT_DELAY_MS
): Promise<Response> {
  const now = Date.now();
  const wait = Math.max(0, minDelayMs - (now - lastFetchAt));
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastFetchAt = Date.now();

  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Referer: "https://www.nba.com/",
    Origin: "https://www.nba.com",
    ...(init?.headers as Record<string, string> | undefined),
  };

  const proxy = process.env.NBA_STATS_PROXY;
  const targetUrl = proxy ? `${proxy}${encodeURIComponent(url)}` : url;

  const res = await fetch(targetUrl, { ...init, headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res;
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await rateLimitedFetch(url, init);
  return res.json() as Promise<T>;
}
