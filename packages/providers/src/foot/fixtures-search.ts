import type { Sport } from "@after-the-whistle/core";
import { gameIdForSport } from "@after-the-whistle/core";
import type { FixturePayload } from "./api-football.js";

const BASE = "https://v3.football.api-sports.io";

export type FixtureMatch = {
  gameId: string;
  label: string;
  status: string;
  sport: Sport;
};

function footHeaders(): Record<string, string> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is required for soccer live lookup");
  return { "x-apisports-key": key };
}

let lastFootFetch = 0;

async function fetchFootJson<T>(url: string): Promise<T> {
  const minDelay = 6500;
  const now = Date.now();
  const wait = Math.max(0, minDelay - (now - lastFootFetch));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastFootFetch = Date.now();

  const res = await fetch(url, { headers: footHeaders() });
  if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

interface ApiFootballResponse<T> {
  response: T[];
}

function fixtureToMatch(f: FixturePayload): FixtureMatch {
  const home = f.teams.home.name;
  const away = f.teams.away.name;
  const hs = f.goals.home ?? 0;
  const as = f.goals.away ?? 0;
  return {
    gameId: gameIdForSport("foot", String(f.fixture.id)),
    label: `${away} ${as} @ ${home} ${hs} (${f.fixture.status.short})`,
    status: f.fixture.status.short,
    sport: "foot",
  };
}

async function searchTeamId(query: string): Promise<number | null> {
  const url = `${BASE}/teams?search=${encodeURIComponent(query)}`;
  const data = await fetchFootJson<
    ApiFootballResponse<{ team: { id: number; name: string } }>
  >(url);
  const team = data.response?.[0]?.team;
  return team?.id ?? null;
}

export async function searchFootFixtures(
  query: string,
  dates: string[] = [],
  limit = 8
): Promise<FixtureMatch[]> {
  
  let cleanQuery = query.replace(/\b(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/gi, "");
  cleanQuery = cleanQuery.replace(/\b\d{1,4}\b/g, "");
  const teamSearch = cleanQuery.trim().split(/\s+/)[0];
  if (!teamSearch) return [];
  const teamId = await searchTeamId(teamSearch);
  if (!teamId) return [];

  if (dates.length > 0) {
    const results = [];
    for (const d of dates) {
      const url = `${BASE}/fixtures?team=${teamId}&date=${d}`;
      const data = await fetchFootJson<ApiFootballResponse<FixturePayload>>(url);
      results.push(...(data.response ?? []).map(fixtureToMatch));
    }
    return results.slice(0, limit);
  }

  const url = `${BASE}/fixtures?team=${teamId}&last=15`;
  const data = await fetchFootJson<ApiFootballResponse<FixturePayload>>(url);
  return (data.response ?? []).slice(0, limit).map(fixtureToMatch);
}

export async function listRecentFootFixtures(limit = 8): Promise<FixtureMatch[]> {
  const url = `${BASE}/fixtures?live=all`;
  try {
    const data = await fetchFootJson<ApiFootballResponse<FixturePayload>>(url);
    const live = (data.response ?? []).map(fixtureToMatch);
    if (live.length >= limit) return live.slice(0, limit);
  } catch {
    // no live fixtures or quota
  }

  const d = new Date();
  const date = d.toISOString().slice(0, 10);
  const dayUrl = `${BASE}/fixtures?date=${date}`;
  const dayData = await fetchFootJson<ApiFootballResponse<FixturePayload>>(dayUrl);
  return (dayData.response ?? []).slice(0, limit).map(fixtureToMatch);
}
