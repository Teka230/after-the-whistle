import type {
  BoxLine,
  ContextBlock,
  Game,
  IngestedGameData,
  MomentumPoint,
  ShotPoint,
  Sport,
  TeamRef,
  TimelineEvent,
} from "@after-the-whistle/core";
import type Database from "better-sqlite3";
import { getDatabase } from "./connection.js";

function parseTeam(json: string): TeamRef {
  return JSON.parse(json) as TeamRef;
}

export class GameRepository {
  constructor(private db: Database.Database = getDatabase()) {}

  saveIngested(data: IngestedGameData): void {
    const { game, boxLines, timeline, contextBlocks, shotCharts, momentum } =
      data;
    const { externalId } = parseExternal(game.id);

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO games (id, sport, external_id, status, started_at, home_team_json, away_team_json, home_score, away_score, season, league)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             status=excluded.status,
             home_score=excluded.home_score,
             away_score=excluded.away_score,
             ingested_at=datetime('now')`
        )
        .run(
          game.id,
          game.sport,
          externalId,
          game.status,
          game.startedAt,
          JSON.stringify(game.homeTeam),
          JSON.stringify(game.awayTeam),
          game.homeScore,
          game.awayScore,
          game.season ?? null,
          game.league ?? null
        );

      this.db.prepare(`DELETE FROM box_lines WHERE game_id = ?`).run(game.id);
      const insertLine = this.db.prepare(
        `INSERT INTO box_lines (game_id, entity_id, entity_name, team_id, stats_json) VALUES (?, ?, ?, ?, ?)`
      );
      for (const line of boxLines) {
        insertLine.run(
          game.id,
          line.entityId,
          line.entityName,
          line.teamId,
          JSON.stringify(line.stats)
        );
      }

      this.db.prepare(`DELETE FROM timeline_events WHERE game_id = ?`).run(game.id);
      const insertEvent = this.db.prepare(
        `INSERT INTO timeline_events (game_id, event_order, clock, period, period_label, type, team_id, description, home_score, away_score, actor_ids_json, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const e of timeline) {
        insertEvent.run(
          game.id,
          e.order,
          e.clock,
          e.period,
          e.periodLabel,
          e.type,
          e.teamId,
          e.description,
          e.homeScore,
          e.awayScore,
          JSON.stringify(e.actorIds),
          e.metadata ? JSON.stringify(e.metadata) : null
        );
      }

      this.db.prepare(`DELETE FROM context_blocks WHERE game_id = ?`).run(game.id);
      const insertBlock = this.db.prepare(
        `INSERT INTO context_blocks (id, game_id, sport, kind, label, summary_text, entity_ids_json, period, payload_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const b of contextBlocks) {
        insertBlock.run(
          b.id,
          b.gameId,
          b.sport,
          b.kind,
          b.label,
          b.summaryText,
          JSON.stringify(b.entityIds),
          b.period ?? null,
          JSON.stringify(b.payload)
        );
      }

      if (shotCharts) {
        this.db.prepare(`DELETE FROM shot_charts WHERE game_id = ?`).run(game.id);
        const insertShot = this.db.prepare(
          `INSERT INTO shot_charts (game_id, entity_id, points_json) VALUES (?, ?, ?)`
        );
        for (const [entityId, points] of Object.entries(shotCharts)) {
          insertShot.run(game.id, entityId, JSON.stringify(points));
        }
      }

      if (momentum) {
        this.db
          .prepare(
            `INSERT INTO momentum (game_id, points_json) VALUES (?, ?)
             ON CONFLICT(game_id) DO UPDATE SET points_json=excluded.points_json`
          )
          .run(game.id, JSON.stringify(momentum));
      }
    });

    tx();
  }

  getGame(gameId: string): Game | null {
    const row = this.db
      .prepare(`SELECT * FROM games WHERE id = ?`)
      .get(gameId) as GameRow | undefined;
    if (!row) return null;
    return rowToGame(row);
  }

  getIngestedAt(gameId: string): string | null {
    const row = this.db
      .prepare(`SELECT ingested_at FROM games WHERE id = ?`)
      .get(gameId) as { ingested_at: string } | undefined;
    return row?.ingested_at ?? null;
  }

  findGames(sport?: Sport, limit = 20): Game[] {
    const rows = sport
      ? (this.db
          .prepare(
            `SELECT * FROM games WHERE sport = ? ORDER BY ingested_at DESC LIMIT ?`
          )
          .all(sport, limit) as GameRow[])
      : (this.db
          .prepare(`SELECT * FROM games ORDER BY ingested_at DESC LIMIT ?`)
          .all(limit) as GameRow[]);
    return rows.map(rowToGame);
  }

  searchGames(query: string): Game[] {
    const q = `%${query.toLowerCase()}%`;
    const rows = this.db
      .prepare(
        `SELECT * FROM games
         WHERE lower(home_team_json) LIKE ? OR lower(away_team_json) LIKE ? OR external_id LIKE ?
         ORDER BY ingested_at DESC LIMIT 10`
      )
      .all(q, q, q) as GameRow[];
    return rows.map(rowToGame);
  }

  getBoxLines(gameId: string): BoxLine[] {
    const rows = this.db
      .prepare(`SELECT * FROM box_lines WHERE game_id = ? ORDER BY entity_name`)
      .all(gameId) as BoxLineRow[];
    return rows.map((r) => ({
      entityId: r.entity_id,
      entityName: r.entity_name,
      teamId: r.team_id,
      stats: JSON.parse(r.stats_json) as BoxLine["stats"],
    }));
  }

  getTimeline(gameId: string): TimelineEvent[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM timeline_events WHERE game_id = ? ORDER BY event_order`
      )
      .all(gameId) as TimelineRow[];
    return rows.map((r) => ({
      order: r.event_order,
      clock: r.clock,
      period: r.period,
      periodLabel: r.period_label,
      type: r.type,
      teamId: r.team_id,
      description: r.description,
      homeScore: r.home_score,
      awayScore: r.away_score,
      actorIds: JSON.parse(r.actor_ids_json) as string[],
      metadata: r.metadata_json
        ? (JSON.parse(r.metadata_json) as Record<string, unknown>)
        : undefined,
    }));
  }

  getContextBlocks(gameId: string, ids?: string[]): ContextBlock[] {
    if (ids && ids.length > 0) {
      const placeholders = ids.map(() => "?").join(",");
      const rows = this.db
        .prepare(
          `SELECT * FROM context_blocks WHERE game_id = ? AND id IN (${placeholders})`
        )
        .all(gameId, ...ids) as ContextBlockRow[];
      return rows.map(rowToBlock);
    }
    const rows = this.db
      .prepare(`SELECT * FROM context_blocks WHERE game_id = ?`)
      .all(gameId) as ContextBlockRow[];
    return rows.map(rowToBlock);
  }

  getShotChart(gameId: string, entityId: string): ShotPoint[] {
    const row = this.db
      .prepare(
        `SELECT points_json FROM shot_charts WHERE game_id = ? AND entity_id = ?`
      )
      .get(gameId, entityId) as { points_json: string } | undefined;
    if (!row) return [];
    return JSON.parse(row.points_json) as ShotPoint[];
  }

  getMomentum(gameId: string): MomentumPoint[] {
    const row = this.db
      .prepare(`SELECT points_json FROM momentum WHERE game_id = ?`)
      .get(gameId) as { points_json: string } | undefined;
    if (!row) return [];
    return JSON.parse(row.points_json) as MomentumPoint[];
  }

  hasGame(gameId: string): boolean {
    const row = this.db
      .prepare(`SELECT 1 FROM games WHERE id = ?`)
      .get(gameId);
    return !!row;
  }

  /** Removes one game and all dependent rows (ON DELETE CASCADE). */
  clearGame(gameId: string): boolean {
    const result = this.db.prepare(`DELETE FROM games WHERE id = ?`).run(gameId);
    return result.changes > 0;
  }

  /** Removes every cached game. Returns number of games deleted. */
  clearAllGames(): number {
    const result = this.db.prepare(`DELETE FROM games`).run();
    return result.changes;
  }
}

interface GameRow {
  id: string;
  sport: Sport;
  external_id: string;
  status: string;
  started_at: string | null;
  home_team_json: string;
  away_team_json: string;
  home_score: number;
  away_score: number;
  season: string | null;
  league: string | null;
}

interface BoxLineRow {
  entity_id: string;
  entity_name: string;
  team_id: string;
  stats_json: string;
}

interface TimelineRow {
  event_order: number;
  clock: string;
  period: number;
  period_label: string;
  type: string;
  team_id: string | null;
  description: string;
  home_score: number;
  away_score: number;
  actor_ids_json: string;
  metadata_json: string | null;
}

interface ContextBlockRow {
  id: string;
  game_id: string;
  sport: Sport;
  kind: string;
  label: string;
  summary_text: string;
  entity_ids_json: string;
  period: number | null;
  payload_json: string;
}

function rowToGame(row: GameRow): Game {
  return {
    id: row.id,
    sport: row.sport,
    status: row.status as Game["status"],
    startedAt: row.started_at,
    homeTeam: parseTeam(row.home_team_json),
    awayTeam: parseTeam(row.away_team_json),
    homeScore: row.home_score,
    awayScore: row.away_score,
    season: row.season ?? undefined,
    league: row.league ?? undefined,
  };
}

function rowToBlock(row: ContextBlockRow): ContextBlock {
  return {
    id: row.id,
    gameId: row.game_id,
    sport: row.sport,
    kind: row.kind as ContextBlock["kind"],
    label: row.label,
    summaryText: row.summary_text,
    entityIds: JSON.parse(row.entity_ids_json) as string[],
    period: row.period ?? undefined,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
  };
}

function parseExternal(compositeId: string): { externalId: string } {
  const idx = compositeId.indexOf(":");
  return { externalId: compositeId.slice(idx + 1) };
}
