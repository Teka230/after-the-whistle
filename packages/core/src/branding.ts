/** Product identity — shared across MCP, widget, and ChatGPT manifest. */

export const APP_NAME = "After the Whistle" as const;

export const APP_SLUG = "after-the-whistle" as const;

export const APP_TAGLINE = "When play stops, the real talk starts." as const;

export const MCP_SERVER_ID = APP_SLUG;

export const BOXSCORE_UI_VERSION = "2026-05-30.7" as const;

export const BOXSCORE_UI_URI =
  `ui://${APP_SLUG}/boxscore-${BOXSCORE_UI_VERSION}` as const;

/** Path prefix when behind Tailscale Funnel next to Project Harness (same host, :443). */
export const MCP_FUNNEL_PATH_PREFIX = "/whistle" as const;

export function normalizeBasePath(raw: string | undefined): string {
  if (!raw?.trim()) return "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function mcpHttpPath(basePath = ""): string {
  const base = normalizeBasePath(basePath);
  return base ? `${base}/mcp` : "/mcp";
}
