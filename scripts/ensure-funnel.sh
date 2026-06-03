#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJETS="$(cd "${ROOT}/.." && pwd)"
# shellcheck disable=SC1091
source "${PROJETS}/scripts/mcp-funnel-lib.sh"

cd "${ROOT}"
if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a && source .env && set +a
fi
PROJETS_ROOT="${PROJETS}"
mcp_funnel_load_env

WHISTLE_PORT="${MCP_PORT:-8788}"
WHISTLE_FUNNEL_PATH="${WHISTLE_FUNNEL_PATH:-/whistle}"
WHISTLE_STATUS_PATH="${MCP_BASE_PATH:-${WHISTLE_FUNNEL_PATH}}"
PUBLIC_HOST="${TAILSCALE_HOST:-macbook-pro-m2-de-teka.tailda6e2e.ts.net}"

echo "→ After the Whistle local (:${WHISTLE_PORT}, base ${WHISTLE_STATUS_PATH})…"
if ! mcp_whistle_local_ok "${WHISTLE_PORT}" "${WHISTLE_STATUS_PATH}"; then
  echo "❌ MCP absent ou MCP_BASE_PATH incorrect"
  echo "   Lance: cd after-the-whistle && MCP_BASE_PATH=${WHISTLE_FUNNEL_PATH} pnpm run up"
  exit 1
fi

echo "→ Funnel Tailscale (${WHISTLE_FUNNEL_PATH} → :${WHISTLE_PORT})…"
if mcp_funnel_handler_ok "${WHISTLE_FUNNEL_PATH}" "${WHISTLE_PORT}" "${PUBLIC_HOST}" \
  && mcp_funnel_public_whistle_ok "${PUBLIC_HOST}" "${WHISTLE_FUNNEL_PATH}"; then
  echo "   Déjà actif"
else
  mcp_funnel_apply_whistle "${WHISTLE_PORT}" "${WHISTLE_FUNNEL_PATH}"
  sleep 2
fi

if ! mcp_funnel_public_whistle_ok "${PUBLIC_HOST}" "${WHISTLE_FUNNEL_PATH}"; then
  echo "❌ Funnel public inaccessible"
  tailscale funnel status 2>&1 || true
  exit 1
fi

echo "✅ Whistle Funnel OK"
echo "   URL ChatGPT: https://${PUBLIC_HOST}${WHISTLE_FUNNEL_PATH}/mcp"
echo ""
echo "Harness (même hostname): https://${PUBLIC_HOST}/mcp"
