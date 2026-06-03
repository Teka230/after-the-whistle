import type { ContextBlock, TeamMatchStats } from "@after-the-whistle/core";
import type { FixtureTeamStatsPayload } from "./api-football.js";

function statValue(
  stats: FixtureTeamStatsPayload["statistics"],
  type: string
): number | undefined {
  const row = stats.find((s) => s.type === type);
  if (row?.value == null) return undefined;
  if (typeof row.value === "number") return row.value;
  const parsed = Number(String(row.value).replace("%", ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Map API-Football team statistics to [home, away] pairs. */
export function normalizeFixtureTeamStats(
  payload: FixtureTeamStatsPayload[],
  homeTeamId: number,
  awayTeamId: number
): TeamMatchStats {
  const home = payload.find((t) => t.team.id === homeTeamId)?.statistics ?? [];
  const away = payload.find((t) => t.team.id === awayTeamId)?.statistics ?? [];

  const pair = (type: string): [number, number] | undefined => {
    const h = statValue(home, type);
    const a = statValue(away, type);
    if (h == null && a == null) return undefined;
    return [h ?? 0, a ?? 0];
  };

  return {
    possession: pair("Ball Possession"),
    shots: pair("Total Shots"),
    shotsOn: pair("Shots on Goal"),
    passes: pair("Total passes"),
    passAccuracy: pair("Passes %"),
    corners: pair("Corner Kicks"),
    fouls: pair("Fouls"),
    yellowCards: pair("Yellow Cards"),
    saves: pair("Goalkeeper Saves"),
  };
}

export function buildTeamStatsContextBlock(
  gameId: string,
  stats: TeamMatchStats
): ContextBlock {
  const fmt = (pair: [number, number] | undefined, suffix = "") =>
    pair ? `${pair[0]}${suffix} – ${pair[1]}${suffix}` : "—";
  return {
    id: `${gameId}:team_stats`,
    gameId,
    sport: "foot",
    kind: "team_match_stats",
    label: "Team match stats",
    summaryText: [
      `Possession: ${fmt(stats.possession, "%")}`,
      `Shots (on target): ${stats.shots?.[0]} (${stats.shotsOn?.[0]}) – ${stats.shots?.[1]} (${stats.shotsOn?.[1]})`,
      `xG: ${fmt(stats.xg)}`,
      `Passes (accuracy): ${stats.passes?.[0]} (${stats.passAccuracy?.[0]}%) – ${stats.passes?.[1]} (${stats.passAccuracy?.[1]}%)`,
      `Corners: ${fmt(stats.corners)} · Fouls: ${fmt(stats.fouls)} · Yellow cards: ${fmt(stats.yellowCards)}`,
    ].join("\n"),
    entityIds: [],
    payload: { ...stats },
  };
}
