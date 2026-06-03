import type { Game, TimelineEvent } from "../domain.js";

/** Map home/away placeholders to composite team ids from the game record. */
export function attachGameTeamIds(
  timeline: TimelineEvent[],
  game: Game
): TimelineEvent[] {
  return timeline.map((e) => {
    if (e.teamId === "home") return { ...e, teamId: game.homeTeam.id };
    if (e.teamId === "away") return { ...e, teamId: game.awayTeam.id };
    return e;
  });
}
