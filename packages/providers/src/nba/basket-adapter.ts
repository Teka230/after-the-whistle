import type { SportAdapter } from "@after-the-whistle/core";
import {
  buildBasketMomentum,
  computeBasketContextBlocks,
  resolveBasketStatContext,
} from "@after-the-whistle/core";
import type {
  BoxLine,
  Game,
  IngestedGameData,
  ShotPoint,
  StatColumn,
  StatKey,
  TimelineEvent,
} from "@after-the-whistle/core";
import { externalGameId, normalizeIngestGameId } from "@after-the-whistle/core";
import { attachGameTeamIds } from "@after-the-whistle/core";
import {
  fetchBoxScoreTraditional,
  fetchPlayByPlay,
  fetchShotChart,
  fetchGameSummary,
} from "./stats-api.js";
import { normalizeBoxScore, normalizePlayByPlay, normalizeSummary } from "./normalize.js";

const STAT_COLUMNS: StatColumn[] = [
  { key: "pts", label: "Points", shortLabel: "PTS", clickable: true },
  { key: "reb", label: "Rebounds", shortLabel: "REB", clickable: true },
  { key: "ast", label: "Assists", shortLabel: "AST", clickable: true },
  { key: "fg", label: "Field goals", shortLabel: "FG", clickable: true },
  { key: "fg3", label: "3pts", shortLabel: "3PT", clickable: true },
  { key: "ft", label: "Free throws", shortLabel: "FT", clickable: true },
  { key: "stl", label: "Steals", shortLabel: "STL", clickable: true },
  { key: "blk", label: "Blocks", shortLabel: "BLK", clickable: true },
  { key: "tov", label: "Turnovers", shortLabel: "TO", clickable: true },
  { key: "pf", label: "Fouls", shortLabel: "PF", clickable: true },
  { key: "plusMinus", label: "+/-", shortLabel: "+/-", clickable: true },
  { key: "min", label: "Minutes", shortLabel: "MIN", clickable: true },
];

export class BasketAdapter implements SportAdapter {
  readonly sport = "basket" as const;
  readonly statColumns = STAT_COLUMNS;

  async fetchGame(gameId: string): Promise<Game> {
    const externalId = externalGameId(gameId);
    const summary = await fetchGameSummary(externalId);
    const sets = parseSets(summary);
    return normalizeSummary(externalId, sets);
  }

  async fetchBoxScore(gameId: string): Promise<BoxLine[]> {
    const externalId = externalGameId(gameId);
    const data = await fetchBoxScoreTraditional(externalId);
    return normalizeBoxScore(data);
  }

  async fetchTimeline(gameId: string): Promise<TimelineEvent[]> {
    const externalId = externalGameId(gameId);
    const boxLines = await this.fetchBoxScore(gameId);
    const data = await fetchPlayByPlay(externalId);
    return normalizePlayByPlay(data, { boxLines });
  }

  async fetchShotChart(gameId: string, entityId: string): Promise<ShotPoint[]> {
    const externalId = externalGameId(gameId);
    const playerId = entityId.replace(/^player_/, "");
    const data = await fetchShotChart(externalId, playerId);
    const rows = data.Shot_Chart_Detail ?? [];
    return rows.map((r) => ({
      x: Number(r.LOC_X ?? 0),
      y: Number(r.LOC_Y ?? 0),
      made: Number(r.SHOT_MADE_FLAG) === 1,
      period: Number(r.PERIOD ?? 1),
      clock: String(r.GAME_CLOCK ?? ""),
    }));
  }

  computeContextBlocks(
    game: Game,
    boxLines: BoxLine[],
    timeline: TimelineEvent[]
  ) {
    return computeBasketContextBlocks(game, boxLines, timeline);
  }

  formatStatHandle(
    gameId: string,
    entityId: string,
    entityName: string,
    _teamId: string,
    statKey: StatKey
  ) {
    return resolveBasketStatContext(
      gameId,
      [],
      entityId,
      entityName,
      _teamId,
      statKey
    );
  }

  async ingest(input: string): Promise<IngestedGameData> {
    const { gameId, externalId } = normalizeIngestGameId(input, "basket");
    const game = await this.fetchGame(gameId);
    const boxLines = await this.fetchBoxScore(gameId);
    const pbp = await fetchPlayByPlay(externalId);
    const rawTimeline = normalizePlayByPlay(pbp, { boxLines });
    const timeline = attachGameTeamIds(rawTimeline, game);
    const contextBlocks = this.computeContextBlocks(game, boxLines, timeline);
    const momentum = buildBasketMomentum(timeline);

    const shotCharts: Record<string, ShotPoint[]> = {};
    const topScorers = [...boxLines]
      .sort((a, b) => Number(b.stats.pts ?? 0) - Number(a.stats.pts ?? 0))
      .slice(0, 3);

    for (const line of topScorers) {
      try {
        shotCharts[line.entityId] = await this.fetchShotChart!(
          gameId,
          line.entityId
        );
      } catch {
        // shot chart optional if rate limited
      }
    }

    return {
      game,
      boxLines,
      timeline,
      contextBlocks,
      shotCharts,
      momentum,
    };
  }
}

function parseSets(data: { resultSets: Array<{ name: string; headers: string[]; rowSet: unknown[][] }> }) {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const rs of data.resultSets ?? []) {
    out[rs.name] = (rs.rowSet ?? []).map((row) => {
      const obj: Record<string, unknown> = {};
      rs.headers.forEach((h, i) => {
        obj[h] = row[i];
      });
      return obj;
    });
  }
  return out;
}

export const basketAdapter = new BasketAdapter();
