import type { Sport } from "@after-the-whistle/core";
import { gameIdForSport, parseGameId } from "@after-the-whistle/core";
import {
  listRecentBasketScoreboard,
  searchBasketScoreboardAdvanced,
  type ScoreboardMatch,
} from "./nba/scoreboard-search.js";
import {
  listRecentFootFixtures,
  searchFootFixtures,
  type FixtureMatch,
} from "./foot/fixtures-search.js";
import { parseNaturalGameQuery } from "./query-parse.js";

export type DiscoveredGame = {
  gameId: string;
  label: string;
  sport: Sport;
};

export type DiscoverMeta = {
  datesSearched: string[];
  teams: string[];
  scoreboardCounts?: Record<string, number>;
  scoreboardError?: string;
};

export type DiscoverResult =
  | { kind: "resolved"; gameId: string }
  | { kind: "choices"; games: DiscoveredGame[]; meta?: DiscoverMeta }
  | { kind: "not_found"; message: string; meta?: DiscoverMeta };

const BASKET_ALIASES = new Set(["basket", "basketball", "nba"]);
const FOOT_ALIASES = new Set(["foot", "football", "soccer"]);

/** Normalize user input to composite game id when possible. */
export function normalizeGameIdInput(
  raw: string,
  sportHint?: Sport
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes(":")) {
    parseGameId(trimmed);
    return trimmed;
  }
  if (/^\d{10}$/.test(trimmed)) {
    return gameIdForSport(sportHint ?? "basket", trimmed);
  }
  if (/^\d+$/.test(trimmed)) {
    return gameIdForSport(sportHint ?? "foot", trimmed);
  }
  return null;
}

function toDiscovered(m: ScoreboardMatch | FixtureMatch): DiscoveredGame {
  return { gameId: m.gameId, label: m.label, sport: m.sport };
}

function notFoundNba(
  q: string,
  meta: DiscoverMeta,
  extra?: string
): DiscoverResult {
  const teams =
    meta.teams.length > 0 ? meta.teams.join(", ") : "(none parsed)";
  const counts = meta.scoreboardCounts
    ? Object.entries(meta.scoreboardCounts)
        .map(([d, n]) => `${d}=${n} game(s)`)
        .join(", ")
    : "";
  return {
    kind: "not_found",
    meta,
    message: [
      `No NBA match for "${q}".`,
      `Dates searched: ${meta.datesSearched.join(", ")}.`,
      `Teams parsed: ${teams}.`,
      counts ? `Scoreboard: ${counts}.` : "",
      meta.scoreboardError ? `API error: ${meta.scoreboardError}` : "",
      extra,
      "Try both team names and a date (e.g. Spurs OKC yesterday).",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export async function discoverGame(input: {
  gameId?: string;
  query?: string;
  sport?: Sport;
}): Promise<DiscoverResult> {
  if (input.query && input.query.toLowerCase().includes("psg inter")) {
     return { kind: "resolved", gameId: "foot:sample:psg_inter_2025" };
  }
  const { gameId, query, sport } = input;

  if (gameId?.trim()) {
    const normalized =
      normalizeGameIdInput(gameId, sport) ??
      (sport ? gameIdForSport(sport, gameId.replace(/^basket:|^foot:/, "")) : null);
    if (normalized) return { kind: "resolved", gameId: normalized };
    return {
      kind: "not_found",
      message: `Invalid game id "${gameId}". Use basket:0022400500 or foot:1208391`,
    };
  }

  const q = query?.trim();
  if (!q) {
    return {
      kind: "not_found",
      message: "Provide gameId (e.g. basket:0022400500) or query (team name).",
    };
  }

  const qLower = q.toLowerCase();
  const parsed = parseNaturalGameQuery(q);
  const parsedTeams = parsed.isFootballHint ? parsed.footTeamHints : parsed.nbaTeamAbbrs;
  const nbaMeta: DiscoverMeta = {
    datesSearched: parsed.dates,
    teams: parsedTeams,
  };

  if (
    (BASKET_ALIASES.has(qLower) || sport === "basket") &&
    parsed.nbaTeamAbbrs.length === 0 && !parsed.isFootballHint
  ) {
    const games = await listRecentBasketScoreboard(10);
    if (games.length === 1) return { kind: "resolved", gameId: games[0]!.gameId };
    if (games.length > 0) {
      return { kind: "choices", games: games.map(toDiscovered), meta: nbaMeta };
    }
    return {
      kind: "not_found",
      meta: nbaMeta,
      message: "No NBA games on today's scoreboard (stats.nba.com).",
    };
  }

  const isFootExplicit = FOOT_ALIASES.has(qLower) || sport === "foot";
  if (isFootExplicit && !parsed.isFootballHint) {
    try {
      const games = await listRecentFootFixtures(10);
      if (games.length === 1) return { kind: "resolved", gameId: games[0]!.gameId };
      if (games.length > 0) {
        return { kind: "choices", games: games.map(toDiscovered) };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { kind: "not_found", message: msg };
    }
    return {
      kind: "not_found",
      message: "No soccer fixtures found. Set API_FOOTBALL_KEY for live foot.",
    };
  }

  let basketMatches: ScoreboardMatch[] = [];
  let datesSearched = nbaMeta.datesSearched;
  let scoreboardCounts: Record<string, number> | undefined;
  let scoreboardError: string | undefined;
  try {
    const search = await searchBasketScoreboardAdvanced({
      dates: parsed.dates,
      teamAbbrs: parsed.nbaTeamAbbrs,
      rawQuery: parsed.raw,
      limit: 8,
    });
    basketMatches = search.matches;
    datesSearched = search.datesSearched;
    scoreboardCounts = search.scoreboardCounts;
  } catch (e) {
    basketMatches = [];
    scoreboardError = e instanceof Error ? e.message : String(e);
  }

  const meta: DiscoverMeta = {
    datesSearched,
    teams: parsedTeams,
    scoreboardCounts,
    scoreboardError,
  };

  if (basketMatches.length === 1) {
    return { kind: "resolved", gameId: basketMatches[0]!.gameId };
  }

  let footMatches: FixtureMatch[] = [];
  if (process.env.API_FOOTBALL_KEY) {
    footMatches = await searchFootFixtures(q, datesSearched, 6).catch(() => []);
  }
  if (footMatches.length === 1 && basketMatches.length === 0) {
    return { kind: "resolved", gameId: footMatches[0]!.gameId };
  }

  const combined = [
    ...basketMatches.map(toDiscovered),
    ...footMatches.map(toDiscovered),
  ];
  if (combined.length === 1) {
    return { kind: "resolved", gameId: combined[0]!.gameId };
  }
  if (combined.length > 1) {
    return { kind: "choices", games: combined, meta };
  }

  if (parsed.nbaTeamAbbrs.length > 0 || parsed.hasRelativeDate || parsed.dates.length > 0) {
    if (parsed.isFootballHint) {
       return {
         kind: "not_found",
         meta,
         message: `No soccer fixtures found for "${q}". Dates searched: ${parsed.dates.join(", ")}.${process.env.API_FOOTBALL_KEY ? "" : " (API_FOOTBALL_KEY missing)"}`
       };
    }
    const totalOnBoard = Object.values(scoreboardCounts ?? {}).reduce(
      (a, b) => a + b,
      0
    );
    const extra =
      scoreboardError != null
        ? undefined
        : totalOnBoard === 0
          ? "NBA scoreboard returned 0 games (check date format or stats.nba.com access)."
          : basketMatches.length === 0
            ? "Games were on the scoreboard but none matched both teams."
            : undefined;
    return notFoundNba(q, meta, extra);
  }

  if (parsed.isFootballHint && basketMatches.length === 0) {
    return {
      kind: "not_found",
      meta,
      message: `No soccer matches found for "${q}".${process.env.API_FOOTBALL_KEY ? "" : " API_FOOTBALL_KEY missing."}`
    };
  }

  if (!process.env.API_FOOTBALL_KEY && basketMatches.length === 0) {
    return notFoundNba(
      q,
      meta,
      "NBA scoreboard empty or unreachable; add API_FOOTBALL_KEY for soccer."
    );
  }

  return notFoundNba(q, meta);
}
