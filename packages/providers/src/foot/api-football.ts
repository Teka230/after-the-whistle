const BASE = "https://v3.football.api-sports.io";
let lastFootFetch = 0;

function headers(): Record<string, string> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    throw new Error("API_FOOTBALL_KEY is required for foot ingestion");
  }
  return { "x-apisports-key": key };
}

async function fetchFootJson<T>(url: string): Promise<T> {
  const minDelay = 6500;
  const now = Date.now();
  const wait = Math.max(0, minDelay - (now - lastFootFetch));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastFootFetch = Date.now();

  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchFixture(fixtureId: number) {
  const url = `${BASE}/fixtures?id=${fixtureId}`;
  const data = await fetchFootJson<ApiFootballResponse<FixturePayload>>(url);
  return data.response?.[0];
}

export async function fetchFixtureEvents(fixtureId: number) {
  const url = `${BASE}/fixtures/events?fixture=${fixtureId}`;
  const data = await fetchFootJson<ApiFootballResponse<EventPayload>>(url);
  return data.response ?? [];
}

export async function fetchFixtureLineups(fixtureId: number) {
  const url = `${BASE}/fixtures/lineups?fixture=${fixtureId}`;
  const data = await fetchFootJson<ApiFootballResponse<LineupPayload>>(url);
  return data.response ?? [];
}

export async function fetchFixturePlayerStats(fixtureId: number) {
  const url = `${BASE}/fixtures/players?fixture=${fixtureId}`;
  const data = await fetchFootJson<ApiFootballResponse<TeamPlayersPayload>>(url);
  return data.response ?? [];
}

export interface FixtureTeamStatsPayload {
  team: { id: number; name: string };
  statistics: Array<{ type: string; value: number | string | null }>;
}

export async function fetchFixtureStatistics(fixtureId: number) {
  const url = `${BASE}/fixtures/statistics?fixture=${fixtureId}`;
  const data = await fetchFootJson<ApiFootballResponse<FixtureTeamStatsPayload>>(url);
  return data.response ?? [];
}

interface ApiFootballResponse<T> {
  response: T[];
  errors?: Record<string, string>;
}

export interface FixturePayload {
  fixture: {
    id: number;
    date: string;
    status: { short: string; long: string };
  };
  league: { name: string; season: number };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
  };
}

export interface EventPayload {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string };
  player: { id: number; name: string } | null;
  assist: { id: number; name: string } | null;
  type: string;
  detail: string;
  comments: string | null;
}

export interface LineupPayload {
  team: { id: number; name: string };
  startXI: Array<{ player: { id: number; name: string } }>;
}

export interface TeamPlayersPayload {
  team: { id: number; name: string };
  players: Array<{
    player: { id: number; name: string };
    statistics: Array<{
      games: { minutes: number | null; rating: string | null };
      shots: { total: number | null; on: number | null };
      goals: { total: number | null; assists: number | null };
      passes: { total: number | null };
      tackles: { total: number | null };
      fouls?: { committed: number | null; drawn?: number | null };
      cards?: { yellow: number | null; red?: number | null };
    }>;
  }>;
}
