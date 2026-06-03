import type { Game, PlayerStint, TimelineEvent } from "../domain.js";
import { buildPlayerStints, summarizePlayerStints } from "./basket.js";
import { buildFootPlayerStints, summarizeFootPlayerStints } from "./foot.js";

export function buildGamePlayerStints(
  game: Game,
  timeline: TimelineEvent[],
  entityId: string,
  teamId: string
): PlayerStint[] {
  if (game.sport === "foot") {
    return buildFootPlayerStints(game, timeline, entityId, teamId);
  }
  return buildPlayerStints(game, timeline, entityId, teamId);
}

export function summarizeGamePlayerStints(
  game: Game,
  stints: PlayerStint[],
  entityName: string,
  teamAbbrev: string
): string {
  if (game.sport === "foot") {
    return summarizeFootPlayerStints(game, stints, entityName, teamAbbrev);
  }
  return summarizePlayerStints(game, stints, entityName, teamAbbrev);
}

export {
  buildPlayerStints,
  summarizePlayerStints,
  fillTimelineScores,
} from "./basket.js";
export {
  buildFootPlayerStints,
  summarizeFootPlayerStints,
  expandFootSubstitutions,
} from "./foot.js";
