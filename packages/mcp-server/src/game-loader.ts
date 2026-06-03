import type { Game, Sport } from "@after-the-whistle/core";
import { discoverGame, getAdapterForGame, sampleDataIsStale, nbaTeamDisplayName } from "@after-the-whistle/providers";
import { findCachedGameByQuery } from "./cache-discovery.js";

import { repo } from "./services.js";

const LIVE_REFRESH_MS = 90_000;
const BASKET_QUERY_ALIASES = new Set(["basket", "basketball", "nba"]);
const FOOT_QUERY_ALIASES = new Set(["foot", "football", "soccer"]);

export type LoadGameInput = {
  gameId?: string;
  query?: string;
  sport?: Sport;
  refresh?: boolean;
};

export type LoadGameResult =
  | { ok: true; game: Game; ingested: boolean; refreshed: boolean; cacheCleared: boolean }
  | {
      ok: false;
      code: "not_found" | "ambiguous" | "ingest_failed";
      message: string;
      choices?: Array<{ gameId: string; label: string }>;
    };

function gameNeedsRefresh(game: Game): boolean {
  if (game.status !== "live") return false;
  const ingestedAt = repo.getIngestedAt(game.id);
  if (!ingestedAt) return true;
  const age = Date.now() - Date.parse(ingestedAt.replace(" ", "T"));
  return age > LIVE_REFRESH_MS;
}

function gameChoice(game: Game): { gameId: string; label: string } {
  return {
    gameId: game.id,
    label: `${game.awayTeam.abbreviation} ${game.awayScore} @ ${game.homeTeam.abbreviation} ${game.homeScore}`,
  };
}

function isGenericSportQuery(query: string, sport?: Sport): sport is Sport {
  const normalized = query.trim().toLowerCase();
  if (sport === "basket" && BASKET_QUERY_ALIASES.has(normalized)) return true;
  if (sport === "foot" && FOOT_QUERY_ALIASES.has(normalized)) return true;
  return false;
}

function cachedSportChoices(sport: Sport, limit = 10) {
  return repo.findGames(sport, limit).map(gameChoice);
}

export async function ingestGameById(gameId: string): Promise<Game> {
  const adapter = getAdapterForGame(gameId);
  const data = await adapter.ingest(gameId);
  repo.saveIngested(data);
  return data.game;
}

export async function loadGameForDisplay(
  input: LoadGameInput
): Promise<LoadGameResult> {
  const { gameId, query, sport, refresh } = input;

  let targetId = gameId?.trim() ? gameId.trim() : undefined;
  let discovered = false;

  if (!targetId && query?.trim() && !refresh) {
    const cachedId = findCachedGameByQuery(repo, query.trim(), sport);
    if (cachedId) {
      targetId = cachedId;
      discovered = true;
    }
  }

  if (!targetId) {
    const discovery = await discoverGame({ gameId, query, sport });
    if (discovery.kind === "resolved") {
      targetId = discovery.gameId;
      discovered = true;
    } else if (discovery.kind === "choices") {
      return {
        ok: false,
        code: "ambiguous",
        message: "Several matches match — call show_game with a specific gameId.",
        choices: discovery.games.map((g) => ({
          gameId: g.gameId,
          label: g.label,
        })),
      };
    } else if (query?.trim()) {
      const cachedId = findCachedGameByQuery(repo, query.trim(), sport);
      if (cachedId) {
        targetId = cachedId;
        discovered = true;
      } else if (sport && isGenericSportQuery(query, sport)) {
        const choices = cachedSportChoices(sport);
        if (choices.length > 0) {
          return {
            ok: false,
            code: "ambiguous",
            message:
              sport === "basket"
                ? "No NBA games on today's scoreboard, but cached basketball matches are available — call show_game with a specific gameId."
                : "No current soccer fixtures found, but cached football matches are available — call show_game with a specific gameId.",
            choices,
          };
        }
      } else {
        const meta = "meta" in discovery ? discovery.meta : undefined;
        const detail = meta
          ? ` Dates searched: ${meta.datesSearched.join(", ")}. Teams: ${meta.teams.join(", ") || "none"}.`
          : "";
        return {
          ok: false,
          code: "not_found",
          message: `${discovery.message}${detail}`,
        };
      }
    } else {
      const meta = "meta" in discovery ? discovery.meta : undefined;
      const detail = meta
        ? ` Dates searched: ${meta.datesSearched.join(", ")}. Teams: ${meta.teams.join(", ") || "none"}.`
        : "";
      return {
        ok: false,
        code: "not_found",
        message: `${discovery.message}${detail}`,
      };
    }
  } else {
    const discovery = await discoverGame({ gameId: targetId, sport });
    if (discovery.kind === "resolved") targetId = discovery.gameId;
  }

  if (!targetId) {
    return {
      ok: false,
      code: "not_found",
      message: "No game selected. Call show_game with a specific gameId.",
    };
  }

  let ingested = false;
  let refreshed = false;
  let cacheCleared = false;
  let game = repo.getGame(targetId);

  if (refresh && game) {
    repo.clearGame(targetId);
    game = null;
    cacheCleared = true;
  }

  const sampleStale = sampleDataIsStale(targetId, repo.getIngestedAt(targetId));

  const shouldIngest =
    refresh ||
    !game ||
    sampleStale ||
    (game && gameNeedsRefresh(game));

  if (shouldIngest) {
    try {
      game = await ingestGameById(targetId);
      ingested = true;
      refreshed = Boolean(refresh || sampleStale || game.status === "live");
    } catch (err) {
      if (game && !refresh) {
        return {
          ok: true,
          game,
          ingested: false,
          refreshed: false,
          cacheCleared,
        };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        code: "ingest_failed",
        message: discovered
          ? `Found ${targetId} but ingest failed: ${msg}`
          : refresh
            ? `Refresh failed for ${targetId}: ${msg}${cacheCleared ? " (cache was cleared)" : ""}`
            : `Ingest failed for ${targetId}: ${msg}`,
      };
    }
  }

  if (!game) {
    return {
      ok: false,
      code: "not_found",
      message: `Game ${targetId} not available.`,
    };
  }

  if (game && game.sport === "basket") {
    if (
      game.homeTeam.name.endsWith(" Home") ||
      game.homeTeam.name.endsWith(" Away") ||
      game.homeTeam.name === "Home" ||
      game.homeTeam.name === "Away"
    ) {
      game.homeTeam.name = nbaTeamDisplayName({
        id: game.homeTeam.id.replace("team_", ""),
        abbr: game.homeTeam.abbreviation,
        fallbackName: game.homeTeam.name,
      });
    }
    if (
      game.awayTeam.name.endsWith(" Home") ||
      game.awayTeam.name.endsWith(" Away") ||
      game.awayTeam.name === "Home" ||
      game.awayTeam.name === "Away"
    ) {
      game.awayTeam.name = nbaTeamDisplayName({
        id: game.awayTeam.id.replace("team_", ""),
        abbr: game.awayTeam.abbreviation,
        fallbackName: game.awayTeam.name,
      });
    }
  }

  return { ok: true, game, ingested, refreshed, cacheCleared };
}

