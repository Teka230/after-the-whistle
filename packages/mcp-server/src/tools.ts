import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import {
  getInsightBundle,
  listSuggestedPrompts,
  personaMeta,
  repo,
  buildStatContextView,
  resolveMomentum,
} from "./services.js";
import { BOXSCORE_UI_URI, attachGameTeamIds, buildGamePlayerStints, extractScoringSequencesFromTimeline, summarizeGamePlayerStints } from "@after-the-whistle/core";
import { getAdapterForGame } from "@after-the-whistle/providers";
import { loadGameForDisplay } from "./game-loader.js";
import { resolveDataStatus } from "./data-status.js";
import { extractTeamMatchStats } from "./team-stats.js";
import { resolveShotChart } from "./shot-chart.js";
import { normalizeShowGameInput } from "./show-game-input.js";
import {
  clearCacheInputSchema,
  getMomentumInputSchema,
  getPlayerStintsInputSchema,
  getShotChartInputSchema,
  getStatContextInputSchema,
  listSuggestedPromptsInputSchema,
  showAnalysisInputSchema,
  showGameInputSchema,
  type VisualAnalysisInput,
} from "./tool-schemas.js";
import type { VisualAnalysis } from "@after-the-whistle/core";

export function registerTools(server: McpServer, widgetHtml: string): void {
  registerAppResource(
    server,
    "boxscore-widget",
    BOXSCORE_UI_URI,
    {
      description: "Interactive box score widget",
      _meta: {
        ui: { prefersBorder: true },
        "openai/widgetDescription":
          "Interactive box score & standalone analysis — click stats for runs, shot chart, verified context.",
      },
    },
    async () => ({
      contents: [
        {
          uri: BOXSCORE_UI_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: widgetHtml,
          _meta: {
            ui: { prefersBorder: true },
            "openai/widgetDescription":
              "Interactive box score & standalone analysis — click stats for runs, shot chart, verified context.",
          },
        },
      ],
    })
  );

  registerAppTool(
    server,
    "show_game",
    {
      title: "Show game [V2]",
      description:
        "Load a match and render the interactive box score widget in ChatGPT (primary UI). Fetches live/final data on demand. User clicks stats in the widget for visual context — do not duplicate the full box score in chat text.",
      inputSchema: showGameInputSchema.shape,
      _meta: {
        ui: {
          resourceUri: BOXSCORE_UI_URI,
          prefersBorder: true,
        },
        "openai/outputTemplate": BOXSCORE_UI_URI,
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "Loading box score…",
        "openai/toolInvocation/invoked": "Box score ready.",
      },
    },
    async (raw) => {
      console.log("[show_game] raw input", JSON.stringify(raw));
      const parsed = showGameInputSchema.parse(raw);
      const { gameId, query, sport, refresh, tone = "analyst" } =
        normalizeShowGameInput(parsed);
      console.log(
        "[show_game] normalized input",
        JSON.stringify({ gameId, query, sport, refresh, tone })
      );
      const loaded = await loadGameForDisplay({ gameId, query, sport, refresh });
      if (!loaded.ok) {
        const choiceLines =
          loaded.choices?.map((c) => `• ${c.gameId} — ${c.label}`).join("\n") ?? "";
        const cached = repo.findGames(undefined, 5);
        const cachedHint =
          cached.length > 0
            ? `\nCached: ${cached.map((g) => g.id).join(", ")}`
            : "";
        return {
          content: [
            {
              type: "text" as const,
              text: [loaded.message, choiceLines, cachedHint].filter(Boolean).join("\n"),
            },
          ],
          structuredContent: {
            error: loaded.code,
            message: loaded.message,
            choices: loaded.choices,
          },
          isError: true,
        };
      }

      const { game, ingested, refreshed, cacheCleared } = loaded;
      const boxLines = repo.getBoxLines(game.id);
      const adapter = getAdapterForGame(game.id);
      const insightBundle = getInsightBundle(game.id);
      const { source, dataCompleteness } = resolveDataStatus(game.id, ingested);
      const teamStats = game.sport === "foot" ? extractTeamMatchStats(game.id) : null;
      const timeline = game.sport === "basket" ? repo.getTimeline(game.id) : [];
      const scoringRuns =
        game.sport === "basket"
          ? extractScoringSequencesFromTimeline(game, timeline)
          : null;
      const scoringRunsTimelineMax =
        timeline.length > 0
          ? timeline.reduce((max, e) => Math.max(max, e.order), 0)
          : undefined;
      const statusNote =
        game.status === "live"
          ? " (live — stats refresh on each load)"
          : source === "fresh_ingest"
            ? refreshed
              ? " (refreshed from provider)"
              : " (loaded from provider)"
            : dataCompleteness === "rich"
              ? " (rich cached data)"
              : "";

      const structuredContent = {
        game,
        boxLines,
        statColumns: adapter.statColumns,
        suggestedPrompts: listSuggestedPrompts(game.id),
        insightBundle,
        ingestMeta: { ingested, refreshed, cacheCleared },
        source,
        dataCompleteness,
        teamStats,
        scoringRuns,
        scoringRunsTimelineMax,
        ...personaMeta(tone, game.sport),
      };

      const summary = `Loaded ${game.awayTeam.abbreviation} ${game.awayScore} — ${game.homeTeam.abbreviation} ${game.homeScore}${statusNote}.`;

      return {
        content: [{ type: "text" as const, text: summary }],
        structuredContent,
        _meta: {
          ui: { resourceUri: BOXSCORE_UI_URI },
          "openai/outputTemplate": BOXSCORE_UI_URI,
          /** Widget-only copy — some hosts deliver _meta to iframe before toolOutput. */
          showGame: structuredContent,
        },
      };
    }
  );

  registerAppTool(
    server,
    "show_analysis",
    {
      title: "Show illustrated analysis",
      description:
        "Render the match widget with a model-authored analysis board. Use standalone_analysis with player_focus/team_focus/turning_point/match_recap/debate_board when the user asks for a dedicated visual UI. Anchor every claim to verified match data; do not invent stats, runs, +/-, or sequences.",
      inputSchema: showAnalysisInputSchema.shape,
      _meta: {
        ui: {
          resourceUri: BOXSCORE_UI_URI,
          prefersBorder: true,
        },
        "openai/outputTemplate": BOXSCORE_UI_URI,
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "Building analysis board…",
        "openai/toolInvocation/invoked": "Analysis board ready.",
      },
    },
    async (raw) => {
      console.log("[show_analysis] raw input", JSON.stringify(raw));
      const parsed = showAnalysisInputSchema.parse(raw);
      const { gameId, query, sport, refresh, tone = "analyst" } =
        normalizeShowGameInput(parsed);
      const loaded = await loadGameForDisplay({ gameId, query, sport, refresh });
      if (!loaded.ok) {
        const choiceLines =
          loaded.choices?.map((c) => `• ${c.gameId} — ${c.label}`).join("\n") ?? "";
        const cached = repo.findGames(undefined, 5);
        const cachedHint =
          cached.length > 0
            ? `\nCached: ${cached.map((g) => g.id).join(", ")}`
            : "";
        return {
          content: [
            {
              type: "text" as const,
              text: [loaded.message, choiceLines, cachedHint].filter(Boolean).join("\n"),
            },
          ],
          structuredContent: {
            error: loaded.code,
            message: loaded.message,
            choices: loaded.choices,
          },
          isError: true,
        };
      }

      const { game, ingested, refreshed, cacheCleared } = loaded;
      const boxLines = repo.getBoxLines(game.id);
      const adapter = getAdapterForGame(game.id);
      const insightBundle = getInsightBundle(game.id);
      const { source, dataCompleteness } = resolveDataStatus(game.id, ingested);
      const teamStats = game.sport === "foot" ? extractTeamMatchStats(game.id) : null;
      const timeline = game.sport === "basket" ? repo.getTimeline(game.id) : [];
      const scoringRuns =
        game.sport === "basket"
          ? extractScoringSequencesFromTimeline(game, timeline)
          : null;
      const scoringRunsTimelineMax =
        timeline.length > 0
          ? timeline.reduce((max, e) => Math.max(max, e.order), 0)
          : undefined;
      const visualAnalysis = normalizeVisualAnalysis({
        ...parsed.analysis,
        viewMode: parsed.viewMode ?? parsed.analysis.viewMode,
        analysisTemplate:
          parsed.analysisTemplate ?? parsed.analysis.analysisTemplate,
        focusEntityIds:
          parsed.focusEntityIds ?? parsed.analysis.focusEntityIds,
        focusTeamIds: parsed.focusTeamIds ?? parsed.analysis.focusTeamIds,
      });

      const structuredContent = {
        game,
        boxLines,
        statColumns: adapter.statColumns,
        suggestedPrompts: listSuggestedPrompts(game.id),
        insightBundle,
        ingestMeta: { ingested, refreshed, cacheCleared },
        source,
        dataCompleteness,
        teamStats,
        scoringRuns,
        scoringRunsTimelineMax,
        visualAnalysis,
        viewMode: visualAnalysis.viewMode,
        analysisTemplate: visualAnalysis.analysisTemplate,
        ...personaMeta(tone, game.sport),
      };

      return {
        content: [
          {
            type: "text" as const,
            text: `Rendered analysis board for ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}.`,
          },
        ],
        structuredContent,
        _meta: {
          ui: { resourceUri: BOXSCORE_UI_URI },
          "openai/outputTemplate": BOXSCORE_UI_URI,
          showGame: structuredContent,
        },
      };
    }
  );

  registerAppTool(
    server,
    "get_stat_context",
    {
      title: "Clicked stat context",
      description:
        "Called by the widget when a stat is clicked. Returns compact play-by-play context.",
      inputSchema: getStatContextInputSchema.shape,
      _meta: { ui: { visibility: ["app", "model"] } },
    },
    async (raw) => {
      const input = getStatContextInputSchema.parse(raw);
      const tone = input.tone ?? "analyst";
      const view = buildStatContextView(
        input.gameId,
        input.entityId,
        input.entityName,
        input.teamId,
        input.statKey,
        input.period,
        tone
      );

      return {
        content: [
          {
            type: "text" as const,
            text: view.uiHeadline,
          },
        ],
        structuredContent: {
          ...view,
          deterministicLayer: {
            contract:
              "Widget shows verified context. Model narrates only from contextText / relatedFacts — never invent stats.",
          },
          ...personaMeta(tone, view.click.sport),
        },
      };
    }
  );

  registerAppTool(
    server,
    "list_suggested_prompts",
    {
      title: "Discussion chips",
      description: "Suggested questions based on match anomalies.",
      inputSchema: listSuggestedPromptsInputSchema.shape,
      _meta: {},
    },
    async (raw) => {
      const { gameId, tone = "analyst" } = listSuggestedPromptsInputSchema.parse(raw);
      const prompts = listSuggestedPrompts(gameId);
      return {
        content: [
          {
            type: "text" as const,
            text: prompts.map((p) => `• ${p.label}`).join("\n"),
          },
        ],
        structuredContent: {
          prompts,
          ...personaMeta(tone, repo.getGame(gameId)?.sport),
        },
      };
    }
  );

  registerAppTool(
    server,
    "get_shot_chart",
    {
      title: "Player shot chart",
      description: "Basketball shot chart for a player.",
      inputSchema: getShotChartInputSchema.shape,
      _meta: { ui: { visibility: ["app", "model"] } },
    },
    async (raw) => {
      const { gameId, entityId } = getShotChartInputSchema.parse(raw);
      const payload = await resolveShotChart(gameId, entityId);
      const text = payload.points.length
        ? `${payload.points.length} shots.`
        : (payload.message ?? "No shot chart available.");
      return {
        content: [{ type: "text" as const, text }],
        structuredContent: payload,
      };
    }
  );

  registerAppTool(
    server,
    "get_momentum",
    {
      title: "Momentum curve",
      description: "Score / momentum over time.",
      inputSchema: getMomentumInputSchema.shape,
      _meta: { ui: { visibility: ["app", "model"] } },
    },
    async (raw) => {
      const { gameId } = getMomentumInputSchema.parse(raw);
      const points = resolveMomentum(gameId);
      const game = repo.getGame(gameId);
      return {
        content: [{ type: "text" as const, text: `${points.length} points momentum.` }],
        structuredContent: {
          points,
          gameId,
          homeAbbrev: game?.homeTeam.abbreviation,
          awayAbbrev: game?.awayTeam.abbreviation,
        },
      };
    }
  );

  registerAppTool(
    server,
    "get_player_stints",
    {
      title: "Player on-floor stints",
      description:
        "On-pitch/on-floor segments with score differential per substitution spell (NBA +/- or football goal diff).",
      inputSchema: getPlayerStintsInputSchema.shape,
      _meta: { ui: { visibility: ["app", "model"] } },
    },
    async (raw) => {
      const { gameId, entityId, entityName, teamId } =
        getPlayerStintsInputSchema.parse(raw);
      const game = repo.getGame(gameId);
      if (!game) {
        return {
          content: [{ type: "text" as const, text: "Game not found." }],
          structuredContent: { error: "not_found", gameId },
          isError: true,
        };
      }

      const line = repo.getBoxLines(gameId).find((l) => l.entityId === entityId);
      const name = entityName ?? line?.entityName ?? entityId;
      const abbrev =
        teamId === game.homeTeam.id
          ? game.homeTeam.abbreviation
          : game.awayTeam.abbreviation;

      const timeline = attachGameTeamIds(repo.getTimeline(gameId), game);
      const stints = buildGamePlayerStints(game, timeline, entityId, teamId);
      const summary = summarizeGamePlayerStints(game, stints, name, abbrev);

      if (stints.length === 0) {
        const message =
          game.sport === "foot"
            ? `${name}: no substitution segments found in the match timeline.`
            : `${name}: no on-floor stints parsed from play-by-play.`;
        return {
          content: [{ type: "text" as const, text: message }],
          structuredContent: {
            gameId,
            entityId,
            entityName: name,
            teamId,
            teamAbbrev: abbrev,
            unavailable: true,
            reason: "no_stints",
            message,
            stints: [],
            summary: message,
            plusMinus: line?.stats.plusMinus ?? null,
          },
        };
      }

      return {
        content: [{ type: "text" as const, text: summary }],
        structuredContent: {
          gameId,
          entityId,
          entityName: name,
          teamId,
          teamAbbrev: abbrev,
          stints,
          summary,
          plusMinus: line?.stats.plusMinus ?? null,
        },
      };
    }
  );

  registerAppTool(
    server,
    "clear_cache",
    {
      title: "Clear SQLite cache",
      description:
        "Delete cached match data from SQLite. Pass gameId to clear one game, or omit to wipe all. Use before show_game refresh when stale widget data persists.",
      inputSchema: clearCacheInputSchema.shape,
      _meta: {},
    },
    async (raw) => {
      const { gameId } = clearCacheInputSchema.parse(raw);
      const id = gameId?.trim();

      if (id) {
        const existed = repo.hasGame(id);
        repo.clearGame(id);
        const text = existed
          ? `Cleared cache for ${id}. Call show_game to re-ingest.`
          : `No cache entry for ${id}.`;
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: {
            cleared: existed ? [id] : [],
            count: existed ? 1 : 0,
          },
        };
      }

      const count = repo.clearAllGames();
      return {
        content: [
          {
            type: "text" as const,
            text:
              count > 0
                ? `Cleared ${count} game(s) from cache. Call show_game to re-ingest.`
                : "Cache was already empty.",
          },
        ],
        structuredContent: { cleared: "all", count },
      };
    }
  );
}

function normalizeVisualAnalysis(analysis: VisualAnalysisInput): VisualAnalysis {
  return {
    ...analysis,
    viewMode: analysis.viewMode ?? "boxscore_with_analysis",
    generatedBy: "model",
    confidence:
      typeof analysis.confidence === "number"
        ? clampPercent(analysis.confidence)
        : undefined,
    points: analysis.points.map((point, index) => ({
      ...point,
      id: point.id || `analysis-point-${index + 1}`,
      tone: point.tone ?? "proof",
      weight:
        typeof point.weight === "number" ? clampPercent(point.weight) : undefined,
      evidence: point.evidence ?? [],
    })),
    timeline: analysis.timeline?.map((item, index) => ({
      ...item,
      id: item.id || `analysis-timeline-${index + 1}`,
      weight:
        typeof item.weight === "number" ? clampPercent(item.weight) : undefined,
      evidence: item.evidence ?? [],
    })),
  };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
