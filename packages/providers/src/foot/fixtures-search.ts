import type { Sport } from "@after-the-whistle/core";
import { gameIdForSport } from "@after-the-whistle/core";
import { fetchEspnScoreboard, type EspnEvent } from "./espn-api.js";
import { fetchOpenFootballMatches } from "./openfootball-api.js";

export type FixtureMatch = {
  gameId: string;
  label: string;
  status: string;
  sport: Sport;
};

const LEAGUES = ["eng.1", "fra.1", "esp.1", "ita.1", "uefa.champions", "fifa.world"];

function espnToMatch(ev: EspnEvent, league: string): FixtureMatch {
  const home = ev.competitions[0].competitors.find(c => c.homeAway === "home") || ev.competitions[0].competitors[0];
  const away = ev.competitions[0].competitors.find(c => c.homeAway === "away") || ev.competitions[0].competitors[1];
  return {
    gameId: gameIdForSport("foot", `${league}_${ev.id}`),
    label: `${away.team.name} ${away.score} @ ${home.team.name} ${home.score} (${ev.status.type.shortDetail})`,
    status: ev.status.type.shortDetail,
    sport: "foot",
  };
}

export async function searchFootFixtures(
  query: string,
  dates: string[] = [],
  limit = 8
): Promise<FixtureMatch[]> {

  let cleanQuery = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  cleanQuery = cleanQuery.replace(/\b(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/gi, "");
  cleanQuery = cleanQuery.replace(/\b\d{1,4}\b/g, "");
  const terms = cleanQuery.trim().toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (terms.length === 0) return [];

  const normalizeText = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const results: FixtureMatch[] = [];

  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const currentMonthRange = `${y}${m}01-${y}${m}31`;

  const searchDates = dates.length ? dates.map(d => d.replace(/-/g, "")) : [currentMonthRange];

  // 1. Search ESPN
  for (const formattedDate of searchDates) {
    for (const league of LEAGUES) {
      try {
        const board = await fetchEspnScoreboard(league, formattedDate);
        for (const ev of board.events || []) {
          const isMatch = terms.every(term =>
            ev.competitions[0].competitors.some(c =>
              normalizeText(c.team.name).includes(term) ||
              (c.team.abbreviation && normalizeText(c.team.abbreviation).includes(term))
            )
          );
          if (isMatch) {
            results.push(espnToMatch(ev, league));
          }
        }
      } catch (e) {
        // ignore
      }
    }
  }

  // 2. OpenFootball Fallback
  if (results.length === 0) {
    try {
      // Just a stub search on worldcup.json for the fallback as an example
      const openMatches = await fetchOpenFootballMatches("worldcup.json", "2022/worldcup.json");
      for (const m of openMatches) {
        const t1 = normalizeText(m.team1);
        const t2 = normalizeText(m.team2);
        if (terms.every(t => t1.includes(t) || t2.includes(t))) {
          results.push({
            gameId: `foot:open_${m.date}_${m.team1.substring(0,3)}_${m.team2.substring(0,3)}`.toLowerCase(),
            label: `${m.team2} @ ${m.team1} (FT) [OpenFootball Fallback]`,
            status: "FT",
            sport: "foot"
          });
        }
      }
    } catch {
      // ignore
    }
  }

  return results.slice(0, limit);
}

export async function listRecentFootFixtures(limit = 8): Promise<FixtureMatch[]> {
  const results: FixtureMatch[] = [];

  for (const league of LEAGUES) {
    if (results.length >= limit) break;
    try {
      const board = await fetchEspnScoreboard(league);
      const live = (board.events || []).filter(ev => ev.status.type.state === "in");
      results.push(...live.map(ev => espnToMatch(ev, league)));
    } catch {
      // ignore
    }
  }

  if (results.length < limit) {
    for (const league of LEAGUES) {
      if (results.length >= limit) break;
      try {
        const board = await fetchEspnScoreboard(league);
        const post = (board.events || []).filter(ev => ev.status.type.state === "post");
        results.push(...post.map(ev => espnToMatch(ev, league)));
      } catch {
        // ignore
      }
    }
  }

  return results.slice(0, limit);
}
