/**
 * Cross-host fallbacks and quota hints for operators.
 */

export const HOST_COMPAT = {
  mcpAppsBridge: ["ui/notifications/tool-result", "tools/call", "ui/message", "ui/update-model-context"],
  openaiExtensions: [
    "window.openai.toolOutput",
    "window.openai.toolInput",
    "window.openai.callTool",
    "window.openai.sendFollowUpMessage",
    "openai:set_globals",
    "ui/initialize",
    "ui/notifications/initialized",
  ],
} as const;

export const QUOTA_HINTS = {
  apiFootballFreePerDay: 100,
  nbaStatsMinDelayMs: 1200,
  recommendation: "Ingest post-match once; widget reads SQLite only.",
} as const;

export function submissionChecklist(): string[] {
  return [
    "MCP server reachable over HTTPS (tunnel for local dev)",
    "Widget builds to single HTML (vite-plugin-singlefile)",
    "CSP: no external scripts in widget bundle",
    "Privacy: no PII stored; game data only",
    "Demo mode works without API keys",
  ];
}
