import type { SportAdapter } from "@after-the-whistle/core";
import {
  buildFootMomentum,
  computeFootContextBlocks,
  resolveFootStatContext,
} from "@after-the-whistle/core";
import type {
  BoxLine,
  Game,
  IngestedGameData,
  StatColumn,
  StatKey,
  TimelineEvent,
} from "@after-the-whistle/core";
import { gameIdForSport, normalizeIngestGameId } from "@after-the-whistle/core";
import {
  fetchEspnSummary,
} from "./espn-api.js";
import {
  buildTeamStatsContextBlock,
} from "./team-stats.js";

const STAT_COLUMNS: StatColumn[] = [
  { key: "goals", label: "Goals", shortLabel: "G", clickable: true },
  { key: "assists", label: "Assists", shortLabel: "A", clickable: true },
  { key: "shots", label: "Shots", shortLabel: "SH", clickable: true },
  { key: "shotsOn", label: "On target", shortLabel: "SOT", clickable: true },
  { key: "xg", label: "xG", shortLabel: "xG", clickable: true },
  { key: "passes", label: "Passes", shortLabel: "PAS", clickable: true },
  { key: "fouls", label: "Fouls", shortLabel: "F", clickable: true },
  { key: "yellowCards", label: "Yellow cards", shortLabel: "YC", clickable: true },
  { key: "rating", label: "Rating", shortLabel: "RTG", clickable: true },
  { key: "minutes", label: "Min", shortLabel: "MIN", clickable: true },
];

export class FootAdapter implements SportAdapter {
  readonly sport = "foot" as const;
  readonly statColumns = STAT_COLUMNS;

  async fetchGame(gameId: string): Promise<Game> {
    const { externalId } = normalizeIngestGameId(gameId, "foot");
    const [league, eventId] = externalId.split("_");
    if (!league || !eventId) throw new Error(`Invalid ESPN gameId: ${gameId}`);

    const summary = await fetchEspnSummary(league, eventId);
    if (!summary || !summary.header) throw new Error(`Fixture not found: ${gameId}`);
    return normalizeFixture(summary, league);
  }

  async fetchBoxScore(gameId: string): Promise<BoxLine[]> {
    const { externalId } = normalizeIngestGameId(gameId, "foot");
    const [league, eventId] = externalId.split("_");
    const summary = await fetchEspnSummary(league, eventId);
    return normalizePlayerStats(summary);
  }

  async fetchTimeline(gameId: string): Promise<TimelineEvent[]> {
    const { externalId } = normalizeIngestGameId(gameId, "foot");
    const [league, eventId] = externalId.split("_");
    const summary = await fetchEspnSummary(league, eventId);
    return normalizeEvents(summary);
  }

  computeContextBlocks(game: Game, boxLines: BoxLine[], timeline: TimelineEvent[]) {
    return computeFootContextBlocks(game, boxLines, timeline);
  }

  formatStatHandle(
    gameId: string,
    entityId: string,
    entityName: string,
    _teamId: string,
    statKey: StatKey
  ) {
    return resolveFootStatContext(gameId, [], entityId, entityName, statKey);
  }

  async ingest(input: string): Promise<IngestedGameData> {
    const { gameId, externalId } = normalizeIngestGameId(input, "foot");
    const [league, eventId] = externalId.split("_");

    const game = await this.fetchGame(gameId);
    const boxLines = await this.fetchBoxScore(gameId);
    const timeline = await this.fetchTimeline(gameId);

    let teamStats: import("@after-the-whistle/core").TeamMatchStats | null = null;
    let contextBlocks: import("@after-the-whistle/core").ContextBlock[] = [];

    try {
      const summary = await fetchEspnSummary(league, eventId);
      if (summary.boxscore?.teams?.length >= 2) {
        teamStats = normalizeEspnTeamStats(summary.boxscore.teams);
      }
    } catch {
      // statistics optional
    }

    // Fallback: Aggregate xG and passes from boxLines if missing in teamStats
    if (!teamStats) teamStats = {};
    if (!teamStats.xg || (teamStats.xg[0] === 0 && teamStats.xg[1] === 0)) {
      let homeXg = 0;
      let awayXg = 0;
      for (const line of boxLines) {
        const lineXg = Number(line.stats.xg) || 0;
        if (line.teamId === game.homeTeam.id) {
          homeXg += lineXg;
        } else if (line.teamId === game.awayTeam.id) {
          awayXg += lineXg;
        }
      }
      if (homeXg > 0 || awayXg > 0) {
        teamStats.xg = [Number(homeXg.toFixed(2)), Number(awayXg.toFixed(2))];
      }
    }

    if (!teamStats.passes || (teamStats.passes[0] === 0 && teamStats.passes[1] === 0)) {
      let homePasses = 0;
      let awayPasses = 0;
      for (const line of boxLines) {
        const linePasses = Number(line.stats.passes) || 0;
        if (line.teamId === game.homeTeam.id) {
          homePasses += linePasses;
        } else if (line.teamId === game.awayTeam.id) {
          awayPasses += linePasses;
        }
      }
      if (homePasses > 0 || awayPasses > 0) {
        teamStats.passes = [homePasses, awayPasses];
      }
    }

    contextBlocks = computeFootContextBlocks(game, boxLines, timeline, teamStats);

    if (teamStats && Object.keys(teamStats).length > 0) {
      contextBlocks = [
        buildTeamStatsContextBlock(gameId, teamStats),
        ...contextBlocks,
      ];
    }

    const momentum = buildFootMomentum(game, timeline);

    return { game, boxLines, timeline, contextBlocks, momentum };
  }
}

function normalizeFixture(f: import("./espn-api.js").EspnSummaryResponse, leagueId: string): Game {
  const ev = f.header.competitions[0];
  const id = gameIdForSport("foot", `${leagueId}_${f.header.id}`);
  const statusMap: Record<string, Game["status"]> = {
    "post": "final",
    "pre": "scheduled",
    "in": "live",
  };

  const homeComp = ev.competitors.find(c => c.homeAway === "home") || ev.competitors[0];
  const awayComp = ev.competitors.find(c => c.homeAway === "away") || ev.competitors[1];

  return {
    id,
    sport: "foot",
    status: statusMap[ev.status.type.state] ?? "final",
    startedAt: ev.date,
    homeTeam: {
      id: `team_${homeComp.team.id}`,
      name: homeComp.team.name,
      abbreviation: homeComp.team.abbreviation || abbrev(homeComp.team.name),
    },
    awayTeam: {
      id: `team_${awayComp.team.id}`,
      name: awayComp.team.name,
      abbreviation: awayComp.team.abbreviation || abbrev(awayComp.team.name),
    },
    homeScore: parseInt(homeComp.score, 10) || 0,
    awayScore: parseInt(awayComp.score, 10) || 0,
    season: "2024",
    league: leagueId,
  };
}

function abbrev(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function normalizeEspnTeamStats(teams: import("./espn-api.js").EspnSummaryResponse["boxscore"]["teams"]): import("@after-the-whistle/core").TeamMatchStats {
  const t1 = teams[0]?.statistics || [];
  const t2 = teams[1]?.statistics || [];

  const getStat = (arr: any[], name: string) => {
    const s = arr.find(x => x.name === name);
    return s ? parseFloat(s.displayValue) : 0;
  };

  return {
    possession: [getStat(t1, "possession"), getStat(t2, "possession")],
    shots: [getStat(t1, "totalShots"), getStat(t2, "totalShots")],
    shotsOn: [getStat(t1, "shotsOnTarget"), getStat(t2, "shotsOnTarget")],
    passes: [getStat(t1, "totalPasses"), getStat(t2, "totalPasses")],
    passAccuracy: [getStat(t1, "passPercent"), getStat(t2, "passPercent")],
    xg: [getStat(t1, "expectedGoals"), getStat(t2, "expectedGoals")],
    corners: [getStat(t1, "wonCorners"), getStat(t2, "wonCorners")],
    fouls: [getStat(t1, "foulsCommitted"), getStat(t2, "foulsCommitted")],
    yellowCards: [getStat(t1, "yellowCards"), getStat(t2, "yellowCards")],
    saves: [getStat(t1, "saves"), getStat(t2, "saves")],
  };
}

function normalizePlayerStats(
  summary: import("./espn-api.js").EspnSummaryResponse
): BoxLine[] {
  const lines: BoxLine[] = [];
  const rosters = summary.rosters || [];
  for (const t of rosters) {
    for (const p of t.roster) {
      if (!p.stats) continue;

      const statArray = Array.isArray(p.stats) ? p.stats : Object.values(p.stats);
      if (statArray.length === 0) continue;

      const getPlayerStat = (name: string) => {
        const s = statArray.find((x: any) => x && x.name === name);
        return s ? parseInt(s.displayValue || "0", 10) : 0;
      };

      const goals = getPlayerStat("totalGoals");
      const shots = getPlayerStat("totalShots");
      const shotsOn = getPlayerStat("shotsOnTarget");

      lines.push({
        entityId: `player_${p.athlete.id}`,
        entityName: p.athlete.displayName,
        teamId: `team_${t.team.id}`,
        stats: {
          goals,
          assists: getPlayerStat("goalAssists"),
          shots,
          shotsOn,
          xg: estimateXg(goals, shots, shotsOn),
          passes: getPlayerStat("totalPasses"), // Might not be available for all, defaults to 0
          tackles: getPlayerStat("totalTackles"),
          fouls: getPlayerStat("foulsCommitted"),
          yellowCards: getPlayerStat("yellowCards"),
          rating: undefined,
          minutes: 0, // Not typically in this ESPN array, would need a different field
        },
      });
    }
  }
  return lines.sort((a, b) => Number(b.stats.goals ?? 0) - Number(a.stats.goals ?? 0));
}

function estimateXg(goals: number, shots: number, onTarget: number): number {
  if (shots === 0) return 0;
  return Math.round((goals * 0.4 + onTarget * 0.12 + shots * 0.04) * 100) / 100;
}

function normalizeEvents(
  summary: import("./espn-api.js").EspnSummaryResponse
): TimelineEvent[] {
  let homeScore = 0;
  let awayScore = 0;

  const homeTeamId = summary.header.competitions[0].competitors.find(c => c.homeAway === "home")?.team.id;

  return (summary.keyEvents || []).map((e, i) => {
    const typeText = String(e.type?.text || "").toLowerCase();
    const isGoal = typeText.includes("goal");
    const isHome = e.team?.id === homeTeamId;

    if (isGoal) {
      if (isHome) homeScore++;
      else awayScore++;
    }

    const clockParts = e.clock?.displayValue?.split("'")[0]?.split("+") || ["0"];
    const elapsed = parseInt(clockParts[0], 10) || 0;

    const period = elapsed <= 45 ? 1 : elapsed <= 90 ? 2 : 3;
    const periodLabel = period === 1 ? "1re MT" : period === 2 ? "2e MT" : "Prol.";

    let type = "event";
    if (isGoal) type = "goal";
    else if (typeText.includes("card")) type = "card";
    else if (typeText.includes("substitution")) type = "sub";

    return {
      order: i + 1,
      clock: e.clock?.displayValue || "",
      period,
      periodLabel,
      type,
      teamId: `team_${e.team?.id}`,
      description: e.text || e.shortText || "",
      homeScore,
      awayScore,
      actorIds: e.participants?.map(p => `player_${p.athlete.id}`) || [],
    };
  });
}

export const footAdapter = new FootAdapter();
