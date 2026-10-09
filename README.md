# After the Whistle — ChatGPT App

**Tagline:** *When play stops, the real talk starts.*

Post-game **basketball** and **soccer** breakdowns in ChatGPT: interactive box score, clickable stats, standalone visual analysis, play-by-play context injected into the conversation.

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

- Node.js 22.x
- pnpm 9+

## Public demo

The GitHub Pages workflow publishes `docs/`. Enable it once in **Repository Settings → Pages → Build and deployment → Source: GitHub Actions**:

- Demo: https://teka230.github.io/after-the-whistle/demo.html
- Architecture: https://teka230.github.io/after-the-whistle/architecture.html

`demo.html` is an interactive simulation with fixed sample data. It does not call the public MCP server or a live LLM. The live ChatGPT widget is served by the MCP deployment below.

## Public MCP deployment

The repository includes a Render Blueprint and Dockerfile. Deploy the Blueprint from Render, then use the service URL with `/whistle/mcp` as the ChatGPT connector endpoint. The service status and deployment health check are available at `/whistle/`. Render's hostname is allowlisted automatically; add custom hostnames to `MCP_ALLOWED_HOSTS` if you configure a custom domain.

The Blueprint uses Render's always-on `starter` compute plan (currently $6/month). SQLite stores a rebuildable match cache at `/tmp`; it is intentionally not persistent. Matches are fetched again when the cache is empty. The public service is a low-traffic demo, not a production service with an availability commitment.

After the service is created, replace `YOUR-RENDER-SERVICE` in `chatgpt-app.json` with the generated service name before registering the connector in ChatGPT. Do not put provider credentials in the repository; configure any required keys in the hosting provider's environment settings.

## Quick start (offline demo)

```bash
cd after-the-whistle
pnpm install
pnpm run ingest:demo
pnpm run up          # MCP on :8788 (local)
pnpm run up:status
```

Local MCP: `http://127.0.0.1:8788/mcp`.

Optional local foreground development with hot reload: `pnpm dev:mcp`.

## Live data (default)

`show_game` **loads on demand**: if the match is not in SQLite, the MCP ingests it from **stats.nba.com** (basket) or ESPN's public soccer endpoints. Live games are **re-fetched** about every 90s.

Examples in ChatGPT:

- `gameId: "basket:0022400500"` or bare `0022400500`
- `query: "Spurs"` — today's NBA scoreboard + team search
- `query: "basket"` — list recent NBA games to pick from
- `query: "PSG"` — resolved through the configured public soccer fixture sources
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
pnpm ingest --sport foot --game <league>_<event-id>
```

## MCP tools

| Tool | Description |
|------|-------------|
| `show_game` | Show the primary interactive box score widget, fetch/refresh data on demand, and return verified match payload |
| `show_analysis` | Render a model-authored visual analysis board anchored to verified data (`player_focus`, `team_focus`, `turning_point`, `match_recap`, `debate_board`) |
| `get_stat_context` | Widget click context for one stat (`entityId`, `entityName`, `teamId`, `statKey`), verified facts + evidence |
| `list_suggested_prompts` | Dynamic suggested questions weighted toward important runs and match context |
| `get_shot_chart` | Basketball shot chart for one player/entity |
| `get_momentum` | Momentum curve from cached or computed timeline points |
| `get_player_stints` | Player on-floor/on-pitch stints with score differential |
| `clear_cache` | Delete one cached match or the full SQLite cache before re-ingesting |

## Personas

`tone`: `analyst` | `fan` | `bar` | `pundit` | `debate` — labels: Tactical, Supporter, Pub talk, Hot take, Debate.

## Structure

```
packages/core      — domain, branding, anomalies, insight engine, personas
packages/db        — SQLite + repository
packages/providers — NBA, ESPN soccer, OpenFootball fallback, and sample adapters
packages/mcp-server — MCP HTTP + tools
packages/widgets   — React iframe UI (whistle mark, tagline, box score)
```

## Tracking

- Product walkthrough: [`docs/demo.html`](./docs/demo.html)

## Product rule

The LLM does not compute runs, +/- or sequences. Those facts are computed upstream in `packages/core/src/insights/` and sent with evidence references (`box_line`, `timeline_event`, `context_block`). The model should only explain, contextualize and simplify.

## ChatGPT

1. `pnpm run up` (or `pnpm dev:mcp` for development)
2. **Public:** deploy with the Render Blueprint, then register `https://<service>.onrender.com/whistle/mcp` as the connector URL.
3. **Local dev:** leave `MCP_BASE_PATH` empty → `http://127.0.0.1:8788/mcp`
4. **Local tunnel for development:** `pnpm run funnel` or `pnpm run expose` (ngrok); these are not the public deployment.
5. Ask: “Show me basket:0022400500” or call `show_game`

## Config

| Variable | Default |
|----------|---------|
| `AFTER_THE_WHISTLE_DB_PATH` | `./data/after-the-whistle.db` |
| `DEBRIEF_DB_PATH` | legacy alias, still supported |
| `MCP_PORT` | `8788` |
| `MCP_BASE_PATH` | empty (local) or `/whistle` (hosted service / tunnel) |
| `PORT` | injected by the hosting platform; local fallback is `8788` |
| `TAILSCALE_HOST` | optional, only for a developer's local tunnel |
| `NBA_STATS_PROXY` | optional proxy prefix for stats.nba.com requests |

## Static docs site

The `docs/` folder is a GitHub Pages-ready presentation of the current app:

- `docs/index.html` — product overview and actual MCP flow
- `docs/demo.html` — static simulation of `show_game` and widget stat clicks
- `docs/architecture.html` — pnpm workspace packages and deterministic pipeline
- `docs/tools.html` — current 8-tool MCP contract
- `docs/setup.html` — public hosting and local development setup

Open `docs/index.html` directly or serve it locally:

```bash
python3 -m http.server 4177 --directory docs
```

## Known limits

- NBA stats.nba.com and ESPN: external services with no availability commitment
- SQLite is a cache; the Render deployment does not persist it across restarts
- balldontlie play-by-play: paid (not used)
