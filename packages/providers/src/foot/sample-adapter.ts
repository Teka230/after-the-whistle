import type {
  BoxLine,
  ContextBlock,
  Game,
  IngestedGameData,
  StatKey,
  TimelineEvent,
} from "@after-the-whistle/core";
import {
  buildFootMomentum,
  computeFootContextBlocks,
  resolveFootStatContext,
  type SportAdapter,
} from "@after-the-whistle/core";
import {
  SNAPSHOT_BOX_LINES,
  SNAPSHOT_GAME,
  SNAPSHOT_GAME_ID,
  SNAPSHOT_TEAM_STATS,
  SNAPSHOT_TIMELINE,
} from "./psg-inter-2025.snapshot.js";
import { buildTeamStatsContextBlock } from "./team-stats.js";

export const SAMPLE_GAME_ID = SNAPSHOT_GAME_ID;
/** Bump when sample timeline/box data changes — stale cache auto-refreshes on load. */
export const SAMPLE_DATA_REVISION = "2026-05-30";

export class SampleFootAdapter implements SportAdapter {
  readonly sport = "foot";

  readonly statColumns = [
    { key: "goals"       as const, label: "Goals",        shortLabel: "G",   clickable: true  },
    { key: "assists"     as const, label: "Assists",      shortLabel: "A",   clickable: true  },
    { key: "shots"       as const, label: "Shots",        shortLabel: "SH",  clickable: true  },
    { key: "shotsOn"     as const, label: "On Target",    shortLabel: "SOT", clickable: true  },
    { key: "xg"          as const, label: "xG",           shortLabel: "xG",  clickable: true  },
    { key: "passes"      as const, label: "Passes",       shortLabel: "PAS", clickable: false },
    { key: "tackles"     as const, label: "Tackles",      shortLabel: "TKL", clickable: false },
    { key: "fouls"       as const, label: "Fouls",        shortLabel: "FL",  clickable: false },
    { key: "yellowCards" as const, label: "Yellow Cards", shortLabel: "YC",  clickable: true  },
    { key: "rating"      as const, label: "Rating",       shortLabel: "RTG", clickable: true  },
  ];

  async fetchGame(gameId: string): Promise<Game> {
    if (gameId !== SAMPLE_GAME_ID) throw new Error(`Sample game not found: ${gameId}`);
    return SNAPSHOT_GAME;
  }

  async fetchBoxScore(_gameId: string): Promise<BoxLine[]> {
    return SNAPSHOT_BOX_LINES;
  }

  async fetchTimeline(_gameId: string): Promise<TimelineEvent[]> {
    return SNAPSHOT_TIMELINE;
  }

  computeContextBlocks(
    game: Game,
    boxLines: BoxLine[],
    timeline: TimelineEvent[]
  ): ContextBlock[] {
    return [
      buildTeamStatsContextBlock(game.id, SNAPSHOT_TEAM_STATS),
      ...computeFootContextBlocks(game, boxLines, timeline),
    ];
  }

  formatStatHandle(
    gameId: string,
    entityId: string,
    entityName: string,
    _teamId: string,
    statKey: StatKey
  ): { contextBlockIds: string[]; suggestedPrompt: string } {
    const blocks = this.computeContextBlocks(SNAPSHOT_GAME, SNAPSHOT_BOX_LINES, SNAPSHOT_TIMELINE);
    return resolveFootStatContext(gameId, blocks, entityId, entityName, String(statKey));
  }

  async ingest(gameId: string): Promise<IngestedGameData> {
    const game = await this.fetchGame(gameId);
    const boxLines = await this.fetchBoxScore(gameId);
    const timeline = await this.fetchTimeline(gameId);
    const contextBlocks = this.computeContextBlocks(game, boxLines, timeline);
    const momentum = buildFootMomentum(game, timeline);
    return { game, boxLines, timeline, contextBlocks, momentum };
  }
}
