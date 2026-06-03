import type { Sport } from "@after-the-whistle/core";
import { parseNaturalGameQuery } from "@after-the-whistle/providers";
import type { GameRepository } from "@after-the-whistle/db";

/** Resolve a cached game when live discovery fails (e.g. old finals off scoreboard). */
function levenshtein(a: string, b: string): number {
  const tmp = [];
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0]![j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i]![j] = Math.min(
        tmp[i - 1]![j]! + 1,
        tmp[i]![j - 1]! + 1,
        tmp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length]![b.length]!;
}

const PLAYER_ALIASES: Record<string, string> = {
  sga: "shai gilgeous alexander",
  wemby: "victor wembanyama",
  cp3: "chris paul",
  kd: "kevin durant",
  ad: "anthony davis",
  chef: "stephen curry",
  curry: "stephen curry",
  lebron: "lebron james",
};

/** Resolve a cached game when live discovery fails (e.g. old finals off scoreboard). */
export function findCachedGameByQuery(
  repo: GameRepository,
  query: string,
  sport?: Sport
): string | undefined {
  const parsed = parseNaturalGameQuery(query);
  const pool = repo.findGames(sport, 40);

  if (parsed.nbaTeamAbbrs.length >= 2) {
    const matches = pool.filter((g) => {
      if (g.sport !== "basket") return false;
      const abbrs = new Set([g.homeTeam.abbreviation, g.awayTeam.abbreviation]);
      return parsed.nbaTeamAbbrs.every((a) => abbrs.has(a));
    });
    if (matches.length === 1) return matches[0]!.id;
    if (matches.length > 1) {
      const final = matches.find((g) => g.status === "final");
      if (final) return final.id;
    }
  }

  // 1. Single-team latest game fallback
  if (parsed.nbaTeamAbbrs.length === 1) {
    const abbr = parsed.nbaTeamAbbrs[0]!;
    const latest = pool.find((g) => g.homeTeam.abbreviation === abbr || g.awayTeam.abbreviation === abbr);
    if (latest) return latest.id;
  }

  // 2. Expand common player aliases in query
  let expandedQuery = query.toLowerCase();
  for (const [alias, fullname] of Object.entries(PLAYER_ALIASES)) {
    if (expandedQuery.includes(alias)) {
      expandedQuery += " " + fullname;
    }
  }

  // 3. Player fuzzy search & fallback to latest game of their team
  const queryWords = expandedQuery.split(/[^a-z0-9]+/i).filter((w) => w.length >= 2);
  const uniquePlayers: Array<{ entityId: string; entityName: string; teamId: string }> = [];
  const seenPlayerIds = new Set<string>();

  for (const game of pool) {
    const lines = repo.getBoxLines(game.id);
    for (const line of lines) {
      if (!seenPlayerIds.has(line.entityId)) {
        seenPlayerIds.add(line.entityId);
        uniquePlayers.push({
          entityId: line.entityId,
          entityName: line.entityName,
          teamId: line.teamId,
        });
      }
    }
  }

  let bestPlayer: typeof uniquePlayers[number] | null = null;
  let bestScore = 0;

  for (const player of uniquePlayers) {
    const playerWords = player.entityName.toLowerCase().split(/[^a-z0-9]+/i).filter((w) => w.length >= 2);
    let score = 0;

    for (const qw of queryWords) {
      for (const pw of playerWords) {
        if (qw === pw) {
          score += 10;
        } else if (pw.startsWith(qw) || qw.startsWith(pw)) {
          score += 5;
        } else if (levenshtein(qw, pw) <= 2) {
          score += 4;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestPlayer = player;
    }
  }

  if (bestPlayer && bestScore >= 5) {
    const teamId = bestPlayer.teamId;
    const latestGame = pool.find((g) => g.homeTeam.id === teamId || g.awayTeam.id === teamId);
    if (latestGame) return latestGame.id;
  }

  // 4. Fallback search by text match on team display names/abbreviations
  for (const game of pool) {
    const homeName = game.homeTeam.name.toLowerCase();
    const awayName = game.awayTeam.name.toLowerCase();
    const homeAbbr = game.homeTeam.abbreviation.toLowerCase();
    const awayAbbr = game.awayTeam.abbreviation.toLowerCase();
    const qLower = query.toLowerCase();

    if (
      qLower.includes(homeAbbr) ||
      qLower.includes(awayAbbr) ||
      homeName.split(/\s+/).some((w) => w.length > 3 && qLower.includes(w)) ||
      awayName.split(/\s+/).some((w) => w.length > 3 && qLower.includes(w))
    ) {
      return game.id;
    }
  }

  const searched = repo.searchGames(query);
  if (searched.length === 1) return searched[0]!.id;

  return undefined;
}
