import type { ContextBlock, TeamMatchStats } from "@after-the-whistle/core";

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
