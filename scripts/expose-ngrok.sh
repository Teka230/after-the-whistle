#!/usr/bin/env bash
# Public HTTPS URL for After the Whistle only (ngrok → local MCP port).
# Does NOT modify Tailscale Funnel on 8787 used by Project Harness.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -f "${ROOT}/.env" ]]; then
  # shellcheck disable=SC1091
  set -a && source "${ROOT}/.env" && set +a
fi

PORT="${MCP_PORT:-8788}"
HARNESS_PORT="${HARNESS_PORT:-8787}"

if [[ "${PORT}" == "${HARNESS_PORT}" ]]; then
  echo "❌ MCP_PORT=${PORT} would conflict with Project Harness (:${HARNESS_PORT})" >&2
  exit 1
fi

if ! curl -sf --max-time 2 "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
  echo "❌ After the Whistle is not running on :${PORT}" >&2
  echo "   Start it first: pnpm run up" >&2
  exit 1
fi

if ! command -v ngrok >/dev/null 2>&1; then
  echo "❌ ngrok not installed. brew install ngrok/ngrok/ngrok" >&2
  exit 1
fi

echo "→ ngrok http ${PORT}  (ChatGPT connector: https://<subdomain>.ngrok-free.app/mcp)"
echo "  Project Harness funnel on :${HARNESS_PORT} is unchanged."
exec ngrok http "${PORT}"
