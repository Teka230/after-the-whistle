#!/usr/bin/env bash
# Start/stop After the Whistle MCP on a dedicated port (default 8788).
# Does not touch Project Harness (8787), Tailscale Funnel, or MCPHistoryGPT.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJETS="$(cd "${ROOT}/.." && pwd)"
HARNESS_PORT="${HARNESS_PORT:-8787}"
WHISTLE_PORT="${MCP_PORT:-8788}"

SUPPORT_DIR="${HOME}/Library/Application Support/AfterTheWhistle"
LOG_DIR="${HOME}/Library/Logs/after-the-whistle"
PID_DIR="${SUPPORT_DIR}/pids"

WHISTLE_PID="${PID_DIR}/mcp.pid"
WHISTLE_LOG="${LOG_DIR}/mcp.log"

ensure_node_runtime() {
  if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
    export NVM_DIR="${HOME}/.nvm"
    # shellcheck disable=SC1091
    source "${NVM_DIR}/nvm.sh"
    nvm use 22 >/dev/null 2>&1 || nvm use default >/dev/null 2>&1 || true
  fi

  local node22_bin="${HOME}/.nvm/versions/node/v22.22.2/bin"
  if [[ -d "${node22_bin}" ]]; then
    export PATH="${node22_bin}:${PATH}"
  fi
}

load_env() {
  if [[ -f "${ROOT}/.env" ]]; then
    # shellcheck disable=SC1091
    set -a && source "${ROOT}/.env" && set +a
  fi
  WHISTLE_PORT="${MCP_PORT:-8788}"
  HARNESS_PORT="${HARNESS_PORT:-8787}"
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [command]

Commands:
  start     Build (if needed) + start MCP server (default)
  stop      Stop MCP started by this script
  restart   stop then start
  status    Local MCP + note if Project Harness is on ${HARNESS_PORT}

Port: MCP_PORT / WHISTLE (default 8788). Project Harness stays on ${HARNESS_PORT}.

Examples:
  pnpm run up
  bash scripts/start.sh status
EOF
}

port_open() {
  curl -sf --max-time 2 "http://127.0.0.1:$1/" >/dev/null 2>&1
}

whistle_health_url() {
  local port="$1"
  local base="${MCP_BASE_PATH:-}"
  if [[ -n "${base}" ]]; then
    echo "http://127.0.0.1:${port}${base%/}/"
  else
    echo "http://127.0.0.1:${port}/"
  fi
}

whistle_port_ready() {
  local port="$1"
  curl -sf --max-time 2 "$(whistle_health_url "${port}")" 2>/dev/null | grep -q after-the-whistle
}

pid_alive() {
  local pid_file="$1"
  [[ -f "${pid_file}" ]] || return 1
  local pid
  pid="$(cat "${pid_file}")"
  [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null
}

start_detached() {
  local pid_file="$1"
  local log_file="$2"
  local cwd="$3"
  shift 3

  python3 - "$pid_file" "$log_file" "$cwd" "$@" <<'PY'
from pathlib import Path
import os
import subprocess
import sys

pid_file = Path(sys.argv[1])
log_file = Path(sys.argv[2])
cwd = sys.argv[3]
cmd = sys.argv[4:]

pid_file.parent.mkdir(parents=True, exist_ok=True)
log_file.parent.mkdir(parents=True, exist_ok=True)

env = os.environ.copy()
log = open(log_file, "ab", buffering=0)
proc = subprocess.Popen(
    cmd,
    cwd=cwd,
    stdin=subprocess.DEVNULL,
    stdout=log,
    stderr=subprocess.STDOUT,
    env=env,
    start_new_session=True,
    close_fds=True,
)
pid_file.write_text(str(proc.pid))
PY
}

show_log_tail() {
  local log_file="$1"
  if [[ -s "${log_file}" ]]; then
    echo "--- tail ${log_file} ---"
    tail -n 25 "${log_file}"
  else
    echo "(empty log)"
  fi
}

resolve_pnpm() {
  ensure_node_runtime
  if [[ -n "${WHISTLE_PNPM:-}" && -x "${WHISTLE_PNPM}" ]]; then
    echo "${WHISTLE_PNPM}"
    return 0
  fi
  if command -v pnpm >/dev/null 2>&1; then
    command -v pnpm
    return 0
  fi
  echo "❌ pnpm not found. Install pnpm or set WHISTLE_PNPM=/path/to/pnpm" >&2
  return 1
}

guard_port() {
  if [[ "${WHISTLE_PORT}" == "${HARNESS_PORT}" ]]; then
    echo "❌ MCP_PORT=${WHISTLE_PORT} conflicts with Project Harness (PORT=${HARNESS_PORT})." >&2
    echo "   Use MCP_PORT=8788 in after-the-whistle/.env" >&2
    exit 1
  fi
}

ensure_built() {
  local pnpm_bin="$1"
  local pnpm_dir
  pnpm_dir="$(dirname "${pnpm_bin}")"
  if [[ ! -f "${ROOT}/packages/mcp-server/dist/index.js" ]]; then
    echo "→ Building MCP server…"
    (cd "${ROOT}" && PATH="${pnpm_dir}:${PATH}" "${pnpm_bin}" -r run build)
  elif [[ ! -f "${ROOT}/packages/widgets/dist/boxscore.html" ]]; then
    echo "→ Building widget…"
    (cd "${ROOT}" && PATH="${pnpm_dir}:${PATH}" "${pnpm_bin}" --filter @after-the-whistle/widgets run build)
  fi
}

start_mcp() {
  guard_port

  if whistle_port_ready "${WHISTLE_PORT}"; then
    echo "✓ After the Whistle already listening (:${WHISTLE_PORT})"
    return 0
  fi

  local pnpm_bin
  pnpm_bin="$(resolve_pnpm)"
  local pnpm_dir
  pnpm_dir="$(dirname "${pnpm_bin}")"
  ensure_built "${pnpm_bin}"

  mkdir -p "${LOG_DIR}" "${PID_DIR}"
  : >"${WHISTLE_LOG}"

  echo "→ After the Whistle MCP (:${WHISTLE_PORT})…"
  local mcp_base="${MCP_BASE_PATH:-}"
  start_detached "${WHISTLE_PID}" "${WHISTLE_LOG}" "${ROOT}" \
    env PATH="${pnpm_dir}:${PATH}" MCP_PORT="${WHISTLE_PORT}" MCP_BASE_PATH="${mcp_base}" \
    "${pnpm_bin}" --filter @after-the-whistle/mcp-server run start

  local wait_seconds="${WHISTLE_START_TIMEOUT_SECONDS:-120}"
  local wait_iterations=$((wait_seconds * 2))
  for _ in $(seq 1 "${wait_iterations}"); do
    if whistle_port_ready "${WHISTLE_PORT}"; then
      local mcp_path="/mcp"
      [[ -n "${mcp_base}" ]] && mcp_path="${mcp_base%/}/mcp"
      echo "✓ After the Whistle ready"
      echo "  MCP:    http://127.0.0.1:${WHISTLE_PORT}${mcp_path}"
      echo "  Status: $(whistle_health_url "${WHISTLE_PORT}")"
      echo "  Log:    ${WHISTLE_LOG}"
      return 0
    fi
    if ! pid_alive "${WHISTLE_PID}"; then
      echo "❌ MCP exited — see ${WHISTLE_LOG}"
      show_log_tail "${WHISTLE_LOG}"
      exit 1
    fi
    sleep 0.5
  done

  echo "❌ MCP did not respond within ${wait_seconds}s — see ${WHISTLE_LOG}"
  show_log_tail "${WHISTLE_LOG}"
  exit 1
}

stop_pid_file() {
  local name="$1"
  local pid_file="$2"
  if pid_alive "${pid_file}"; then
    local pid
    pid="$(cat "${pid_file}")"
    echo "→ Stopping ${name} (pid ${pid})…"
    kill "${pid}" 2>/dev/null || true
    for _ in $(seq 1 10); do
      kill -0 "${pid}" 2>/dev/null || break
      sleep 0.3
    done
    if kill -0 "${pid}" 2>/dev/null; then
      kill -9 "${pid}" 2>/dev/null || true
    fi
    rm -f "${pid_file}"
    echo "✓ ${name} stopped"
  else
    rm -f "${pid_file}"
    echo "○ ${name} was not running (pid file only)"
  fi
}

ensure_demo_data() {
  [[ "${WHISTLE_AUTO_DEMO:-0}" == "1" ]] || return 0
  local health
  health="$(curl -sf --max-time 3 "$(whistle_health_url "${WHISTLE_PORT}")" 2>/dev/null || true)"
  if [[ -n "${health}" ]] && echo "${health}" | grep -q '"games":\[\]'; then
    echo "→ Base vide — seed démo (WHISTLE_AUTO_DEMO=1)…"
    local pnpm_bin
    pnpm_bin="$(resolve_pnpm)"
    local pnpm_dir
    pnpm_dir="$(dirname "${pnpm_bin}")"
    (cd "${ROOT}" && PATH="${pnpm_dir}:${PATH}" "${pnpm_bin}" run ingest:demo)
  fi
}

cmd_start() {
  start_mcp
  ensure_demo_data
  local host="${TAILSCALE_HOST:-}"
  local funnel_path="${WHISTLE_FUNNEL_PATH:-/whistle}"
  local mcp_path="/mcp"
  [[ -n "${MCP_BASE_PATH:-}" ]] && mcp_path="${MCP_BASE_PATH%/}/mcp"
  echo ""
  if [[ -n "${MCP_BASE_PATH:-}" ]]; then
    if [[ -n "${host}" ]]; then
      echo "Tailscale dev URL: https://${host}${funnel_path}/mcp"
      echo "  → pnpm run funnel (developer machine only)"
    else
      echo "Tailscale dev URL not configured. Set TAILSCALE_HOST before using pnpm run funnel."
    fi
  else
    echo "ChatGPT (local uniquement): http://127.0.0.1:${WHISTLE_PORT}/mcp"
    echo "Pour Tailscale: MCP_BASE_PATH=${funnel_path} dans .env puis pnpm run up:restart && pnpm run funnel"
  fi
  if port_open "${HARNESS_PORT}"; then
    echo ""
    if [[ -n "${host}" ]]; then
      echo "ℹ Project Harness :${HARNESS_PORT} — https://${host}/mcp"
    else
      echo "ℹ Project Harness :${HARNESS_PORT} — local service"
    fi
  fi
}

cmd_stop() {
  stop_pid_file "After the Whistle MCP" "${WHISTLE_PID}"
}

cmd_status() {
  echo "=== After the Whistle ==="
  if whistle_port_ready "${WHISTLE_PORT}"; then
    local mcp_path="/mcp"
    [[ -n "${MCP_BASE_PATH:-}" ]] && mcp_path="${MCP_BASE_PATH%/}/mcp"
    echo "✓ MCP  http://127.0.0.1:${WHISTLE_PORT}${mcp_path}"
    if [[ -n "${MCP_BASE_PATH:-}" ]]; then
      local host="${TAILSCALE_HOST:-}"
      if [[ -n "${host}" ]]; then
        echo "     dev tunnel https://${host}${WHISTLE_FUNNEL_PATH:-/whistle}/mcp"
      else
        echo "     set TAILSCALE_HOST to configure the developer tunnel URL"
      fi
    fi
  else
    echo "✗ MCP  inactive (:${WHISTLE_PORT})"
  fi
  if [[ -f "${WHISTLE_PID}" ]]; then
    echo "   pid file: ${WHISTLE_PID} ($(cat "${WHISTLE_PID}" 2>/dev/null || echo ?))"
  fi
  echo ""
  echo "=== Project Harness (read-only) ==="
  if port_open "${HARNESS_PORT}"; then
    echo "✓ Harness  http://127.0.0.1:${HARNESS_PORT}/mcp  (separate app)"
  else
    echo "○ Harness  not running on :${HARNESS_PORT}"
  fi
}

cmd_restart() {
  cmd_stop
  sleep 1
  local pnpm_bin
  pnpm_bin="$(resolve_pnpm)"
  local pnpm_dir
  pnpm_dir="$(dirname "${pnpm_bin}")"
  echo "→ Rebuilding packages…"
  (cd "${ROOT}" && PATH="${pnpm_dir}:${PATH}" "${pnpm_bin}" -r --workspace-concurrency=1 run build)
  cmd_start
}

CMD="${1:-start}"
load_env
case "${CMD}" in
  start) cmd_start ;;
  stop) cmd_stop ;;
  restart) cmd_restart ;;
  status) cmd_status ;;
  -h|--help|help) usage ;;
  *)
    echo "Unknown command: ${CMD}"
    usage
    exit 1
    ;;
esac
