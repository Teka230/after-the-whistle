import type {
  ContextBlock,
  Game,
  IngestedGameData,
  StatColumn,
  StatKey,
  Sport,
  TimelineEvent,
  BoxLine,
} from "./domain.js";

export interface SportAdapter {
  readonly sport: Sport;
  readonly statColumns: StatColumn[];
  fetchGame(gameId: string): Promise<Game>;
  fetchBoxScore(gameId: string): Promise<BoxLine[]>;
  fetchTimeline(gameId: string): Promise<TimelineEvent[]>;
  fetchShotChart?(gameId: string, entityId: string): Promise<import("./domain.js").ShotPoint[]>;
  computeContextBlocks(
    game: Game,
    boxLines: BoxLine[],
    timeline: TimelineEvent[]
  ): ContextBlock[];
  formatStatHandle(
    gameId: string,
    entityId: string,
    entityName: string,
    teamId: string,
    statKey: StatKey
  ): { contextBlockIds: string[]; suggestedPrompt: string };
  ingest(gameId: string): Promise<IngestedGameData>;
}

export function gameIdForSport(sport: Sport, externalId: string): string {
  return `${sport}:${externalId}`;
}

export function parseGameId(compositeId: string): { sport: Sport; externalId: string } {
  const idx = compositeId.indexOf(":");
  if (idx === -1) {
    throw new Error(`Invalid game id: ${compositeId}`);
  }
  const sport = compositeId.slice(0, idx) as Sport;
  if (sport !== "basket" && sport !== "foot") {
    throw new Error(`Unknown sport in game id: ${compositeId}`);
  }
  return { sport, externalId: compositeId.slice(idx + 1) };
}

/** Canonical composite id + provider-local external id for ingest/fetch. */
export function normalizeIngestGameId(
  input: string,
  expectedSport: Sport
): { gameId: string; externalId: string } {
  if (input.includes(":")) {
    const { sport, externalId } = parseGameId(input);
    if (sport !== expectedSport) {
      throw new Error(
        `Expected ${expectedSport} game id, got ${sport} in "${input}"`
      );
    }
    return { gameId: input, externalId };
  }
  return {
    gameId: gameIdForSport(expectedSport, input),
    externalId: input,
  };
}

export function externalGameId(compositeOrExternal: string): string {
  return compositeOrExternal.includes(":")
    ? parseGameId(compositeOrExternal).externalId
    : compositeOrExternal;
}
