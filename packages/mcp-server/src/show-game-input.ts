import type { Sport, Tone } from "@after-the-whistle/core";

export type NormalizedShowGameInput = {
  gameId?: string;
  query?: string;
  sport?: Sport;
  refresh: boolean;
  tone?: Tone;
};

const REFRESH_TOKEN =
  /\b(refresh|reload|force(?:\s+refresh)?|update(?:\s+data)?|re-ingest|reingest)\b/i;
const GAME_ID_REFRESH_MARKER = /(?:::|#)(?:clearCache|refresh)$/i;
const GAME_ID_REFRESH_QUERY =
  /(?:^|&)(?:clearCache|refresh|reload)(?:=(?:1|true))?(?:&|$)/i;

const SPORT_HINTS: Array<{ sport: Sport; pattern: RegExp }> = [
  { sport: "basket", pattern: /\b(basket|basketball|nba)\b/i },
  { sport: "foot", pattern: /\b(foot|football|soccer|ucl|ligue\s*1)\b/i },
];

/** ChatGPT connector may omit optional refresh/sport — recover from query/gameId. */
export function normalizeShowGameInput(input: {
  gameId?: string;
  query?: string;
  sport?: Sport;
  refresh?: boolean;
  clearCache?: boolean;
  tone?: Tone;
}): NormalizedShowGameInput {
  let refresh = Boolean(input.refresh || input.clearCache);
  let gameId = input.gameId?.trim() || undefined;
  let query = input.query?.trim() || undefined;
  let sport = input.sport;

  if (gameId && GAME_ID_REFRESH_MARKER.test(gameId)) {
    refresh = true;
    gameId = gameId.replace(GAME_ID_REFRESH_MARKER, "") || undefined;
  }

  if (gameId?.includes("?")) {
    const [id, search] = gameId.split("?", 2);
    gameId = id || undefined;
    if (search && GAME_ID_REFRESH_QUERY.test(search)) {
      refresh = true;
    }
  }

  if (gameId?.endsWith(":refresh")) {
    refresh = true;
    gameId = gameId.slice(0, -":refresh".length);
  }

  if (query) {
    if (REFRESH_TOKEN.test(query)) {
      refresh = true;
      query =
        query.replace(REFRESH_TOKEN, " ").replace(/\s+/g, " ").trim() || undefined;
    }
    if (!sport && query) {
      for (const hint of SPORT_HINTS) {
        if (hint.pattern.test(query)) {
          sport = hint.sport;
          break;
        }
      }
    }
  }

  return {
    gameId,
    query,
    sport,
    refresh,
    tone: input.tone,
  };
}
