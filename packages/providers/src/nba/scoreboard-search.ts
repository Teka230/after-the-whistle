import type { Sport } from "@after-the-whistle/core";
import { gameIdForSport } from "@after-the-whistle/core";
import { fetchScoreboard, type NbaScoreboardGame } from "./stats-api.js";
import { rowMatchesTeams } from "./team-aliases.js";

export type ScoreboardMatch = {
  gameId: string;
  label: string;
  status: string;
  sport: Sport;
  gameDate?: string;
};

function formatDateOffset(days: number, now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DATE_NOISE =
  /\b(yesterday|today|tonight|last night|ce soir|hier|aujourd'hui|nba|basket|basketball|game)\b/gi;

function rowMatchesSubstring(row: NbaScoreboardGame, q: string): boolean {
  const hay = [
    row.HOME_TEAM_ABBREVIATION,
    row.VISITOR_TEAM_ABBREVIATION,
    row.HOME_TEAM_NAME,
    row.VISITOR_TEAM_NAME,
    row.GAME_ID,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function rowMatchesTeamFilter(
  row: NbaScoreboardGame,
  teamAbbrs: string[]
): boolean {
  if (teamAbbrs.length === 0) return true;
  return rowMatchesTeams(
    String(row.HOME_TEAM_ABBREVIATION ?? ""),
    String(row.VISITOR_TEAM_ABBREVIATION ?? ""),
    String(row.HOME_TEAM_NAME ?? ""),
    String(row.VISITOR_TEAM_NAME ?? ""),
    teamAbbrs
  );
}

function toMatch(row: NbaScoreboardGame, gameDate?: string): ScoreboardMatch {
  const home = row.HOME_TEAM_ABBREVIATION ?? "HOME";
  const away = row.VISITOR_TEAM_ABBREVIATION ?? "AWAY";
  const hs = row.PTS_HOME ?? "-";
  const as = row.PTS_VISITOR ?? "-";
  const dateBit = gameDate ? ` — ${gameDate}` : "";
  return {
    gameId: gameIdForSport("basket", row.GAME_ID),
    label: `${away} ${as} @ ${home} ${hs} (${row.GAME_STATUS_TEXT ?? "?"})${dateBit}`,
    status: row.GAME_STATUS_TEXT ?? "",
    sport: "basket",
    gameDate,
  };
}

export type BasketScoreboardSearchParams = {
  dates: string[];
  teamAbbrs: string[];
  rawQuery?: string;
  limit?: number;
};

export type BasketScoreboardSearchResult = {
  matches: ScoreboardMatch[];
  datesSearched: string[];
  /** Games on scoreboard per date before team filter */
  scoreboardCounts: Record<string, number>;
};

export async function searchBasketScoreboardAdvanced(
  params: BasketScoreboardSearchParams,
  now = new Date()
): Promise<BasketScoreboardSearchResult> {
  const limit = params.limit ?? 8;
  const dates =
    params.dates.length > 0
      ? [...new Set(params.dates)]
      : [formatDateOffset(0, now), formatDateOffset(-1, now)];

  const seen = new Set<string>();
  const out: ScoreboardMatch[] = [];
  const scoreboardCounts: Record<string, number> = {};

  const residual = (params.rawQuery ?? "")
    .toLowerCase()
    .replace(DATE_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const date of dates) {
    const rows = await fetchScoreboard(date);
    scoreboardCounts[date] = rows.length;
    for (const row of rows) {
      const teamOk = rowMatchesTeamFilter(row, params.teamAbbrs);
      const textOk =
        params.teamAbbrs.length > 0
          ? teamOk
          : residual.length > 0
            ? rowMatchesSubstring(row, residual)
            : true;
      if (!textOk) continue;

      const id = row.GAME_ID;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(toMatch(row, date));
      if (out.length >= limit) {
        return { matches: out, datesSearched: dates, scoreboardCounts };
      }
    }
  }

  return { matches: out, datesSearched: dates, scoreboardCounts };
}

/** Legacy single-string search (today + yesterday, substring). */
export async function searchBasketScoreboard(
  query: string,
  limit = 8
): Promise<ScoreboardMatch[]> {
  const { matches } = await searchBasketScoreboardAdvanced({
    dates: [formatDateOffset(0), formatDateOffset(-1)],
    teamAbbrs: [],
    rawQuery: query,
    limit,
  });
  return matches;
}

export async function listRecentBasketScoreboard(limit = 8): Promise<ScoreboardMatch[]> {
  const seen = new Set<string>();
  const out: ScoreboardMatch[] = [];

  for (const offset of [0, -1]) {
    const date = formatDateOffset(offset);
    const rows = await fetchScoreboard(date);
    for (const row of rows) {
      if (seen.has(row.GAME_ID)) continue;
      seen.add(row.GAME_ID);
      out.push(toMatch(row, date));
      if (out.length >= limit) return out;
    }
  }

  return out;
}
