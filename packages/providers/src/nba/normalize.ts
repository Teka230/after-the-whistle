import type { BoxLine, Game, TimelineEvent } from "@after-the-whistle/core";
import { gameIdForSport } from "@after-the-whistle/core";

import type { PlayByPlayPayload } from "./stats-api.js";
import { nbaTeamAbbr, nbaTeamDisplayName } from "./team-aliases.js";

function isoClockToDisplay(clock: string): string {
  const m = clock.match(/PT(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/i);
  if (!m) return clock;
  const mins = m[1] ? parseInt(m[1], 10) : 0;
  const secs = m[2] ? Math.floor(parseFloat(m[2])) : 0;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function buildPlayerNameLookup(boxLines: BoxLine[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of boxLines) {
    const name = line.entityName.trim();
    if (!name) continue;
    const lower = name.toLowerCase();
    map.set(lower, line.entityId);
    const parts = name.split(/\s+/);
    const last = parts[parts.length - 1]?.toLowerCase();
    if (last) map.set(last, line.entityId);
    const hyphen = parts.find((p) => p.includes("-"));
    if (hyphen) map.set(hyphen.toLowerCase(), line.entityId);
  }
  return map;
}

function resolvePlayerName(name: string, lookup: Map<string, string>): string | null {
  const key = name.trim().toLowerCase();
  if (lookup.has(key)) return lookup.get(key)!;
  const last = key.split(/\s+/).pop();
  if (last && lookup.has(last)) return lookup.get(last)!;
  for (const [k, id] of lookup) {
    if (key.includes(k) || k.includes(key)) return id;
  }
  return null;
}

function parseSubPlayers(
  description: string,
  personOutId: number | null,
  lookup: Map<string, string>
): { playerIn: string | null; playerOut: string | null } {
  const playerOut =
    personOutId && personOutId > 0 ? `player_${personOutId}` : null;
  const m = description.match(/^SUB:\s*(.+?)\s+FOR\s+(.+)$/i);
  if (!m) {
    return { playerIn: null, playerOut };
  }
  const playerIn = resolvePlayerName(m[1]!, lookup);
  const outFromDesc = resolvePlayerName(m[2]!, lookup);
  return {
    playerIn,
    playerOut: playerOut ?? outFromDesc,
  };
}

function classifyPlayType(
  actionType: string,
  subType: string,
  desc: string,
  shotResult: string
): string {
  const at = actionType.toLowerCase();
  const st = subType.toLowerCase();
  const lower = desc.toLowerCase();
  if (at === "period") {
    if (st === "start") return "period_start";
    if (st === "end") return "period_end";
  }
  if (at === "substitution" || lower.startsWith("sub:")) return "substitution";
  if (at === "made shot" || shotResult.toLowerCase() === "made") return "made_shot";
  if (at === "missed shot" || lower.includes("miss")) return "missed_shot";
  if (at.startsWith("free throw") || at === "free throw") return "free_throw";
  if (at === "rebound") return "rebound";
  if (at === "turnover") return "turnover";
  if (at === "foul") return "foul";
  return "event";
}


export function normalizeSummary(
  externalGameId: string,
  sets: Record<string, Record<string, unknown>[]>
): Game {
  const lineScore = sets.LineScore ?? [];
  const info = sets.GameSummary ?? sets.gameInfo ?? [];
  const gameInfo = info[0] ?? {};

  const home = lineScore.find((t) => Number(t.HOME_TEAM_ID ?? t.TEAM_ID) > 0 && String(t.TEAM_ABBREVIATION).length <= 3) ?? lineScore[0];
  const away = lineScore.find((t) => t !== home) ?? lineScore[1];

  const homeId = String(home?.TEAM_ID ?? gameInfo.HOME_TEAM_ID ?? "home");
  const awayId = String(away?.TEAM_ID ?? gameInfo.VISITOR_TEAM_ID ?? "away");

  const statusText = String(gameInfo.GAME_STATUS_TEXT ?? "Final");
  const status = statusText.toLowerCase().includes("final")
    ? "final"
    : statusText.toLowerCase().includes("pm") ||
        statusText.toLowerCase().includes("am")
      ? "scheduled"
      : "live";

  return {
    id: gameIdForSport("basket", externalGameId),
    sport: "basket",
    status,
    startedAt: String(gameInfo.GAME_DATE_EST ?? null) || null,
    homeTeam: {
      id: `team_${homeId}`,
      name: nbaTeamDisplayName({
        id: homeId,
        abbr: String(home?.TEAM_ABBREVIATION ?? ""),
        city: home?.TEAM_CITY_NAME,
        name: home?.TEAM_NAME,
        fallbackName: "Home",
      }),
      abbreviation: nbaTeamAbbr({
        id: homeId,
        abbr: String(home?.TEAM_ABBREVIATION ?? ""),
        fallback: "HOM",
      }),
    },
    awayTeam: {
      id: `team_${awayId}`,
      name: nbaTeamDisplayName({
        id: awayId,
        abbr: String(away?.TEAM_ABBREVIATION ?? ""),
        city: away?.TEAM_CITY_NAME,
        name: away?.TEAM_NAME,
        fallbackName: "Away",
      }),
      abbreviation: nbaTeamAbbr({
        id: awayId,
        abbr: String(away?.TEAM_ABBREVIATION ?? ""),
        fallback: "AWY",
      }),
    },
    homeScore: Number(home?.PTS ?? 0),
    awayScore: Number(away?.PTS ?? 0),
    season: String(gameInfo.SEASON ?? ""),
    league: "NBA",
  };
}

export function normalizeBoxScore(
  sets: Record<string, Record<string, unknown>[]>
): BoxLine[] {
  const players = [
    ...(sets.PlayerStats ?? []),
    ...(sets.homeTeamPlayers ?? []),
  ];
  const seen = new Set<string>();
  const lines: BoxLine[] = [];

  for (const p of players) {
    const pid = String(p.PLAYER_ID ?? "");
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);

    const fg = `${p.FGM ?? 0}-${p.FGA ?? 0}`;
    const fg3 = `${p.FG3M ?? 0}-${p.FG3A ?? 0}`;
    const ft = `${p.FTM ?? 0}-${p.FTA ?? 0}`;

    lines.push({
      entityId: `player_${pid}`,
      entityName: `${p.PLAYER_NAME ?? p.FIRST_NAME ?? ""} ${p.FAMILY_NAME ?? p.LAST_NAME ?? ""}`.trim() || `Player ${pid}`,
      teamId: `team_${p.TEAM_ID ?? ""}`,
      stats: {
        pts: Number(p.PTS ?? 0),
        reb: Number(p.REB ?? 0),
        ast: Number(p.AST ?? 0),
        fg,
        fgPct: Number(p.FG_PCT ?? 0),
        fg3,
        fg3Pct: Number(p.FG3_PCT ?? 0),
        ft,
        ftPct: Number(p.FT_PCT ?? 0),
        stl: Number(p.STL ?? 0),
        blk: Number(p.BLK ?? 0),
        tov: Number(p.TO ?? 0),
        pf: Number(p.PF ?? 0),
        plusMinus: Number(p.PLUS_MINUS ?? 0),
        min: String(p.MIN ?? "0"),
      },
    });
  }

  return lines.sort((a, b) => Number(b.stats.pts ?? 0) - Number(a.stats.pts ?? 0));
}

function normalizePlayByPlayV3(
  actions: Record<string, unknown>[],
  boxLines: BoxLine[]
): TimelineEvent[] {
  const lookup = buildPlayerNameLookup(boxLines);
  return actions.map((p, i) => {
    const desc = String(p.description ?? "");
    const actionType = String(p.actionType ?? "");
    const subType = String(p.subType ?? "");
    const shotResult = String(p.shotResult ?? "");
    const type = classifyPlayType(actionType, subType, desc, shotResult);
    const period = Number(p.period ?? 1);
    const teamNumeric = Number(p.teamId ?? 0);
    const teamId = teamNumeric > 0 ? `team_${teamNumeric}` : null;
    const personId = Number(p.personId ?? 0);
    const playerId = personId > 0 ? `player_${personId}` : null;

    let playerIn: string | undefined;
    let playerOut: string | undefined;
    if (type === "substitution") {
      const sub = parseSubPlayers(desc, personId || null, lookup);
      playerIn = sub.playerIn ?? undefined;
      playerOut = sub.playerOut ?? undefined;
    }

    const actorIds = [playerId, playerIn, playerOut].filter(
      (id): id is string => !!id
    );

    const homeScore = Number(p.scoreHome ?? 0) || 0;
    const awayScore = Number(p.scoreAway ?? 0) || 0;

    return {
      order: Number(p.actionId ?? p.actionNumber ?? i + 1),
      clock: isoClockToDisplay(String(p.clock ?? "")),
      period,
      periodLabel: period <= 4 ? `Q${period}` : `OT${period - 4}`,
      type,
      teamId,
      description: desc,
      homeScore,
      awayScore,
      actorIds,
      metadata: {
        playerIn,
        playerOut,
        eventMsgType: actionType,
      },
    };
  });
}

export function normalizePlayByPlay(
  payload: PlayByPlayPayload | Record<string, Record<string, unknown>[]>,
  options?: { boxLines?: BoxLine[] }
): TimelineEvent[] {
  if (typeof payload === "object" && payload !== null && "kind" in payload) {
    const tagged = payload as PlayByPlayPayload;
    if (tagged.kind === "v3") {
      return normalizePlayByPlayV3(tagged.actions, options?.boxLines ?? []);
    }
    return normalizePlayByPlayV2(tagged.sets);
  }
  return normalizePlayByPlayV2(
    payload as Record<string, Record<string, unknown>[]>
  );
}

function normalizePlayByPlayV2(
  sets: Record<string, Record<string, unknown>[]>
): TimelineEvent[] {
  const plays = sets.PlayByPlay ?? [];
  return plays.map((p, i) => {
    const desc = String(p.HOMEDESCRIPTION || p.VISITORDESCRIPTION || p.NEUTRALDESCRIPTION || "");
    const isHome = !!p.HOMEDESCRIPTION;
    const isAway = !!p.VISITORDESCRIPTION;
    const msgType = Number(p.EVENTMSGTYPE ?? 0);
    const lower = desc.toLowerCase();

    let type = "event";
    if (msgType === 1 || (lower.includes("makes") && !lower.includes("miss"))) {
      type = "made_shot";
    } else if (msgType === 2 || lower.includes("miss")) {
      type = "missed_shot";
    } else if (msgType === 3 || lower.includes("free throw")) {
      type = "free_throw";
    } else if (msgType === 4 || lower.includes("rebound")) {
      type = "rebound";
    } else if (msgType === 5 || lower.includes("turnover")) {
      type = "turnover";
    } else if (msgType === 6 || lower.includes("foul")) {
      type = "foul";
    } else if (msgType === 8 || lower.includes("sub:") || lower.includes(" enters ")) {
      type = "substitution";
    } else if (msgType === 12) {
      type = "period_start";
    } else if (msgType === 13) {
      type = "period_end";
    }

    const period = Number(p.PERIOD ?? 1);
    const player1Id = p.PLAYER1_ID ? `player_${p.PLAYER1_ID}` : null;
    const player2Id = p.PLAYER2_ID ? `player_${p.PLAYER2_ID}` : null;
    const actorIds = [player1Id, type === "substitution" ? player2Id : null].filter(
      (id): id is string => !!id
    );

    return {
      order: Number(p.EVENTNUM ?? i + 1),
      clock: String(p.PCTIMESTRING ?? ""),
      period,
      periodLabel: period <= 4 ? `Q${period}` : `OT${period - 4}`,
      type,
      teamId: isHome ? "home" : isAway ? "away" : null,
      description: desc,
      homeScore: Number(p.SCOREHOME ?? 0) || 0,
      awayScore: Number(p.SCOREAWAY ?? 0) || 0,
      actorIds,
      metadata: {
        playerIn: player1Id ?? undefined,
        playerOut: player2Id ?? undefined,
        player2: p.PLAYER2_ID,
        eventMsgType: msgType,
        eventMsg: p.EVENTMSGTYPE,
      },
    };
  });
}
