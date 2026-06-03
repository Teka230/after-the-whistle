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
import { externalGameId, gameIdForSport, normalizeIngestGameId } from "@after-the-whistle/core";
import {
  fetchFixture,
  fetchFixtureEvents,
  fetchFixturePlayerStats,
  fetchFixtureStatistics,
} from "./api-football.js";
import {
  buildTeamStatsContextBlock,
  normalizeFixtureTeamStats,
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
    const fixture = await fetchFixture(Number(externalGameId(gameId)));
    if (!fixture) throw new Error(`Fixture not found: ${gameId}`);
    return normalizeFixture(fixture);
  }

  async fetchBoxScore(gameId: string): Promise<BoxLine[]> {
    const stats = await fetchFixturePlayerStats(Number(externalGameId(gameId)));
    return normalizePlayerStats(stats);
  }

  async fetchTimeline(gameId: string): Promise<TimelineEvent[]> {
    const events = await fetchFixtureEvents(Number(externalGameId(gameId)));
    const fixture = await fetchFixture(Number(externalGameId(gameId)));
    if (!fixture) return [];
    return normalizeEvents(events, fixture);
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
    const fixtureId = Number(externalId);
    const game = await this.fetchGame(gameId);
    const boxLines = await this.fetchBoxScore(gameId);
    const timeline = await this.fetchTimeline(gameId);
    let contextBlocks = this.computeContextBlocks(game, boxLines, timeline);

    try {
      const fixture = await fetchFixture(fixtureId);
      const teamPayload = await fetchFixtureStatistics(fixtureId);
      if (fixture && teamPayload.length >= 2) {
        const teamStats = normalizeFixtureTeamStats(
          teamPayload,
          fixture.teams.home.id,
          fixture.teams.away.id
        );
        contextBlocks = [
          buildTeamStatsContextBlock(gameId, teamStats),
          ...contextBlocks,
        ];
      }
    } catch {
      // statistics optional when API quota/key issues
    }

    const momentum = buildFootMomentum(game, timeline);

    return { game, boxLines, timeline, contextBlocks, momentum };
  }
}

function normalizeFixture(f: import("./api-football.js").FixturePayload): Game {
  const id = gameIdForSport("foot", String(f.fixture.id));
  const statusMap: Record<string, Game["status"]> = {
    FT: "final",
    AET: "final",
    PEN: "final",
    NS: "scheduled",
    LIVE: "live",
    "1H": "live",
    HT: "live",
    "2H": "live",
  };

  return {
    id,
    sport: "foot",
    status: statusMap[f.fixture.status.short] ?? "final",
    startedAt: f.fixture.date,
    homeTeam: {
      id: `team_${f.teams.home.id}`,
      name: f.teams.home.name,
      abbreviation: abbrev(f.teams.home.name),
    },
    awayTeam: {
      id: `team_${f.teams.away.id}`,
      name: f.teams.away.name,
      abbreviation: abbrev(f.teams.away.name),
    },
    homeScore: f.goals.home ?? 0,
    awayScore: f.goals.away ?? 0,
    season: String(f.league.season),
    league: f.league.name,
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

function normalizePlayerStats(
  teams: import("./api-football.js").TeamPlayersPayload[]
): BoxLine[] {
  const lines: BoxLine[] = [];
  for (const t of teams) {
    for (const p of t.players) {
      const s = p.statistics[0];
      if (!s) continue;
      const shots = s.shots.total ?? 0;
      const goals = s.goals.total ?? 0;
      lines.push({
        entityId: `player_${p.player.id}`,
        entityName: p.player.name,
        teamId: `team_${t.team.id}`,
        stats: {
          goals,
          assists: s.goals.assists ?? 0,
          shots,
          shotsOn: s.shots.on ?? 0,
          xg: estimateXg(goals, shots, s.shots.on ?? 0),
          passes: s.passes.total ?? 0,
          tackles: s.tackles.total ?? 0,
          fouls: s.fouls?.committed ?? 0,
          yellowCards: s.cards?.yellow ?? 0,
          rating: s.games.rating ? Number(s.games.rating) : undefined,
          minutes: s.games.minutes ?? 0,
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
  events: import("./api-football.js").EventPayload[],
  fixture: import("./api-football.js").FixturePayload
): TimelineEvent[] {
  let homeScore = 0;
  let awayScore = 0;

  return events.map((e, i) => {
    const isGoal =
      e.type === "Goal" ||
      e.detail.toLowerCase().includes("goal");
    if (isGoal) {
      if (e.team.id === fixture.teams.home.id) homeScore++;
      else awayScore++;
    }

    const period =
      e.time.elapsed <= 45 ? 1 : e.time.elapsed <= 90 ? 2 : 3;
    const periodLabel =
      period === 1 ? "1re MT" : period === 2 ? "2e MT" : "Prol.";

    let type = "event";
    if (isGoal) type = "goal";
    else if (e.type === "Card") type = "card";
    else if (e.detail.toLowerCase().includes("subst")) type = "sub";

    const desc = [
      e.player?.name,
      e.detail,
      e.assist?.name ? `(assist: ${e.assist.name})` : "",
    ]
      .filter(Boolean)
      .join(" — ");

    return {
      order: i + 1,
      clock: `${e.time.elapsed}'${e.time.extra ? `+${e.time.extra}` : ""}`,
      period,
      periodLabel,
      type,
      teamId: `team_${e.team.id}`,
      description: desc || e.detail,
      homeScore,
      awayScore,
      actorIds: e.player?.id ? [`player_${e.player.id}`] : [],
    };
  });
}

export const footAdapter = new FootAdapter();
