# After the Whistle — ChatGPT App

**Tagline:** *When play stops, the real talk starts.*

Post-game **basketball** and **soccer** breakdowns in ChatGPT: interactive box score, clickable stats, play-by-play context injected into the conversation.

The main value is not classic vector RAG. The backend first turns the match into **verified structured facts** via a deterministic engine, then the LLM explains and narrates those facts in the right tone.

```text
Data providers
  -> Deterministic insight engine
  -> Verified facts + evidence
  -> Targeted retrieval on click
  -> LLM = narration/commentary
  -> ChatGPT widget
```

## Prerequisites

- Node.js 20+
- pnpm 9+

## Quick start (offline demo)

```bash
cd after-the-whistle
pnpm install
pnpm ingest --demo
pnpm run up          # MCP on :8788 (build + background, like Project Harness)
pnpm run up:status
```

Local MCP: `http://127.0.0.1:8788/mcp` — **port 8788 by design** so it does not conflict with [Project Harness](../ProjectHarness) on **8787**.

## Running alongside Project Harness

| App | Port | Public (ChatGPT) | Start |
|-----|------|------------------|--------|
| **Project Harness** | `8787` | Tailscale Funnel → `https://<host>/mcp` | `cd ProjectHarness && npm run up` |
| **After the Whistle** | `8788` | Same Tailscale host → `https://<host>/whistle/mcp` | `cd after-the-whistle && pnpm run up` |

- Harness `start.sh` / Funnel / OAuth are **not modified** by Whistle.
- Do **not** set `MCP_PORT=8787` for Whistle — the start script will refuse it.
- For ChatGPT over the internet: set `MCP_BASE_PATH=/whistle` in `.env`, then `pnpm run up` and `pnpm run funnel`.
- Matches are fetched live on first `show_game` — no demo ingest required.
- Optional offline: `pnpm run ingest:demo` or `WHISTLE_AUTO_DEMO=1` on `pnpm run up`.
- Two connectors in ChatGPT: one URL per app.

Dev (foreground, hot reload): `pnpm dev:mcp`

## Live data (default)

`show_game` **loads on demand**: if the match is not in SQLite, the MCP ingests it from **stats.nba.com** (basket) or **API-Football** (soccer). Live games are **re-fetched** about every 90s.

Examples in ChatGPT:

- `gameId: "basket:0022400500"` or bare `0022400500`
- `query: "Spurs"` — today's NBA scoreboard + team search
- `query: "basket"` — list recent NBA games to pick from
- `query: "PSG"` — needs `API_FOOTBALL_KEY` in `.env`
- `refresh: true` or `clearCache: true` — force provider re-fetch
- stale-schema fallback: put the refresh marker in `gameId`, e.g. `basket:0042500304?clearCache=true`, `basket:0042500304#clearCache`, `basket:0042500304::clearCache`, or `basket:0042500304:refresh`
- `clear_cache` — delete SQLite cache for one `gameId` or all games, then call `show_game` to re-ingest

Offline demo only when you want it:

```bash
pnpm run ingest:demo
```

Manual CLI ingest (same providers):

```bash
pnpm ingest --sport basket --game 0022400500
pnpm ingest --sport foot --game 1208391   # requires API_FOOTBALL_KEY
```

## MCP tools

| Tool | Description |
|------|-------------|
| `show_game` | Show box score widget + discussion chips |
| `get_stat_context` | Context on click (widget only), verified facts + evidence |
| `list_suggested_prompts` | Dynamic suggested questions |
| `get_shot_chart` | Basketball shot chart (SVG) |
| `get_momentum` | Momentum curve |

## Personas

`tone`: `analyst` | `fan` | `bar` | `pundit` | `debate` — labels: Tactical, Supporter, Pub talk, Hot take, Debate.

## Structure

```
packages/core      — domain, branding, anomalies, insight engine, personas
packages/db        — SQLite + repository
packages/providers — NBA + API-Football adapters
packages/mcp-server — MCP HTTP + tools
packages/widgets   — React iframe UI (whistle mark, tagline, box score)
```

## Tracking

- Backlog connector/UI ChatGPT: [`TICKETS_ATW_CHATGPT_CONNECTOR.md`](./TICKETS_ATW_CHATGPT_CONNECTOR.md)

## Product rule

The LLM does not compute runs, +/- or sequences. Those facts are computed upstream in `packages/core/src/insights/` and sent with evidence references (`box_line`, `timeline_event`, `context_block`). The model should only explain, contextualize and simplify.

## ChatGPT

1. `pnpm run up` (or `pnpm dev:mcp` for development)
2. **Public (recommended):** `MCP_BASE_PATH=/whistle` in `.env`, then `pnpm run funnel` — connector `https://<TAILSCALE_HOST>/whistle/mcp` (see `chatgpt-app.json`)
3. **Local dev:** leave `MCP_BASE_PATH` empty → `http://127.0.0.1:8788/mcp`
4. **Fallback:** `pnpm run expose` (ngrok) if Funnel is unavailable
5. Ask: “Show me basket:0022400500” or call `show_game`

## Config

| Variable | Default |
|----------|---------|
| `AFTER_THE_WHISTLE_DB_PATH` | `./data/after-the-whistle.db` |
| `DEBRIEF_DB_PATH` | legacy alias, still supported |
| `MCP_PORT` | `8788` |
| `MCP_BASE_PATH` | empty (local) or `/whistle` (Tailscale Funnel) |
| `TAILSCALE_HOST` | your machine hostname (see `.env.example`) |

## Known limits

- NBA stats.nba.com: no SLA, caching required
- API-Football free: 100 req/day
- balldontlie play-by-play: paid (not used)
