import { fetchJson } from "../http.js";
import { nbaTeamAbbr, nbaTeamDisplayName } from "./team-aliases.js";

const BASE = "https://stats.nba.com/stats";

export interface NbaScoreboardGame {
  GAME_ID: string;
  GAME_STATUS_TEXT: string;
  GAME_DATE_EST: string;
  HOME_TEAM_ID: number;
  VISITOR_TEAM_ID: number;
  HOME_TEAM_ABBREVIATION: string;
  VISITOR_TEAM_ABBREVIATION: string;
  HOME_TEAM_NAME?: string;
  VISITOR_TEAM_NAME?: string;
  PTS_HOME?: string;
  PTS_VISITOR?: string;
}

/** YYYY-MM-DD → MM/DD/YYYY for stats.nba.com when ISO returns no games */
function toUsGameDate(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  return `${m[2]}/${m[3]}/${m[1]}`;
}

function parseScoreboardPayload(data: NbaStatsResponse): NbaScoreboardGame[] {
  const sets = parseResultSets(data);
  const headers = sets.GameHeader ?? [];
  const lineScore = sets.LineScore ?? [];

  const linesByGame = new Map<string, Record<string, unknown>[]>();
  for (const line of lineScore) {
    const gid = String(line.GAME_ID ?? "");
    if (!gid) continue;
    const list = linesByGame.get(gid) ?? [];
    list.push(line);
    linesByGame.set(gid, list);
  }

  const fromHeader: NbaScoreboardGame[] = headers.map((h) => {
    const gid = String(h.GAME_ID ?? "");
    const homeId = Number(h.HOME_TEAM_ID);
    const visitorId = Number(h.VISITOR_TEAM_ID);
    const lines = linesByGame.get(gid) ?? [];
    const homeLine =
      lines.find((l) => Number(l.TEAM_ID) === homeId) ??
      lines[0];
    const visitorLine =
      lines.find((l) => Number(l.TEAM_ID) === visitorId) ??
      lines.find((l) => l !== homeLine) ??
      lines[1];

    return {
      GAME_ID: gid,
      GAME_STATUS_TEXT: String(h.GAME_STATUS_TEXT ?? ""),
      GAME_DATE_EST: String(h.GAME_DATE_EST ?? ""),
      HOME_TEAM_ID: homeId,
      VISITOR_TEAM_ID: visitorId,
      HOME_TEAM_ABBREVIATION: nbaTeamAbbr({
        id: homeId,
        abbr: String(homeLine?.TEAM_ABBREVIATION ?? ""),
        fallback: "",
      }),
      VISITOR_TEAM_ABBREVIATION: nbaTeamAbbr({
        id: visitorId,
        abbr: String(visitorLine?.TEAM_ABBREVIATION ?? ""),
        fallback: "",
      }),
      HOME_TEAM_NAME: nbaTeamDisplayName({
        id: homeId,
        abbr: String(homeLine?.TEAM_ABBREVIATION ?? ""),
        city: homeLine?.TEAM_CITY_NAME,
        name: homeLine?.TEAM_NAME,
        fallbackName: "",
      }),
      VISITOR_TEAM_NAME: nbaTeamDisplayName({
        id: visitorId,
        abbr: String(visitorLine?.TEAM_ABBREVIATION ?? ""),
        city: visitorLine?.TEAM_CITY_NAME,
        name: visitorLine?.TEAM_NAME,
        fallbackName: "",
      }),
      PTS_HOME: homeLine?.PTS != null ? String(homeLine.PTS) : undefined,
      PTS_VISITOR:
        visitorLine?.PTS != null ? String(visitorLine.PTS) : undefined,
    };
  });

  if (fromHeader.length > 0) return fromHeader;

  // Fallback: build one row per game from LineScore pairs only
  const out: NbaScoreboardGame[] = [];
  for (const [gid, lines] of linesByGame) {
    if (lines.length < 2) continue;
    const [a, b] = lines;
    out.push({
      GAME_ID: gid,
      GAME_STATUS_TEXT: "Final",
      GAME_DATE_EST: String(a.GAME_DATE_EST ?? ""),
      HOME_TEAM_ID: Number(a.TEAM_ID),
      VISITOR_TEAM_ID: Number(b.TEAM_ID),
      HOME_TEAM_ABBREVIATION: nbaTeamAbbr({
        id: Number(a.TEAM_ID),
        abbr: String(a.TEAM_ABBREVIATION ?? ""),
        fallback: "",
      }),
      VISITOR_TEAM_ABBREVIATION: nbaTeamAbbr({
        id: Number(b.TEAM_ID),
        abbr: String(b.TEAM_ABBREVIATION ?? ""),
        fallback: "",
      }),
      HOME_TEAM_NAME: nbaTeamDisplayName({
        id: Number(a.TEAM_ID),
        abbr: String(a.TEAM_ABBREVIATION ?? ""),
        city: a.TEAM_CITY_NAME,
        name: a.TEAM_NAME,
        fallbackName: "",
      }),
      VISITOR_TEAM_NAME: nbaTeamDisplayName({
        id: Number(b.TEAM_ID),
        abbr: String(b.TEAM_ABBREVIATION ?? ""),
        city: b.TEAM_CITY_NAME,
        name: b.TEAM_NAME,
        fallbackName: "",
      }),
      PTS_HOME: a.PTS != null ? String(a.PTS) : undefined,
      PTS_VISITOR: b.PTS != null ? String(b.PTS) : undefined,
    });
  }
  return out;
}

async function fetchScoreboardForGameDate(gameDate: string): Promise<NbaScoreboardGame[]> {
  const url = `${BASE}/scoreboardv2?GameDate=${encodeURIComponent(gameDate)}&LeagueID=00&DayOffset=0`;
  const data = await fetchJson<NbaStatsResponse>(url);
  return parseScoreboardPayload(data);
}

export async function fetchScoreboard(date?: string): Promise<NbaScoreboardGame[]> {
  const ymd = date ?? formatDateYmd(new Date());
  let rows = await fetchScoreboardForGameDate(ymd);
  if (rows.length === 0 && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    rows = await fetchScoreboardForGameDate(toUsGameDate(ymd));
  }
  return rows;
}

export async function fetchBoxScoreTraditional(gameId: string) {
  const url = `${BASE}/boxscoretraditionalv2?GameID=${gameId}&StartPeriod=0&EndPeriod=14&RangeType=0`;
  const data = await fetchJson<NbaStatsResponse>(url);
  return parseResultSets(data);
}

export type PlayByPlayPayload =
  | { kind: "v3"; actions: Record<string, unknown>[] }
  | { kind: "v2"; sets: Record<string, Record<string, unknown>[]> };

export async function fetchPlayByPlay(gameId: string): Promise<PlayByPlayPayload> {
  const v3Url = `${BASE}/playbyplayv3?GameID=${gameId}&StartPeriod=0&EndPeriod=14`;
  const v3Data = await fetchJson<{ game?: { actions?: Record<string, unknown>[] } }>(v3Url);
  const actions = v3Data.game?.actions ?? [];
  if (actions.length > 0) {
    return { kind: "v3", actions };
  }
  const v2Url = `${BASE}/playbyplayv2?GameID=${gameId}&StartPeriod=0&EndPeriod=14`;
  const data = await fetchJson<NbaStatsResponse>(v2Url);
  return { kind: "v2", sets: parseResultSets(data) };
}

function seasonTypeForGameId(gameId: string): string {
  if (gameId.startsWith("004")) return "Playoffs";
  if (gameId.startsWith("001")) return "Pre+Season";
  return "Regular+Season";
}

export async function fetchShotChart(gameId: string, playerId: string) {
  const seasonType = seasonTypeForGameId(gameId);
  const url = `${BASE}/shotchartdetail?GameID=${gameId}&PlayerID=${playerId}&SeasonType=${seasonType}&TeamID=0`;
  const data = await fetchJson<NbaStatsResponse>(url);
  return parseResultSets(data);
}

interface NbaStatsResponse {
  resultSets: Array<{
    name: string;
    headers: string[];
    rowSet: unknown[][];
  }>;
}

function parseResultSets(data: NbaStatsResponse): Record<string, Record<string, unknown>[]> {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const rs of data.resultSets ?? []) {
    out[rs.name] = (rs.rowSet ?? []).map((row) =>
      rowToObject(rs.headers, row)
    );
  }
  return out;
}

function rowToObject<T extends Record<string, unknown>>(
  headers: string[],
  row: unknown[]
): T {
  const obj: Record<string, unknown> = {};
  headers.forEach((h, i) => {
    obj[h] = row[i];
  });
  return obj as T;
}

function formatDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fetchGameSummary(gameId: string) {
  const url = `${BASE}/boxscoresummaryv2?GameID=${gameId}`;
  return fetchJson<NbaStatsResponse>(url);
}
