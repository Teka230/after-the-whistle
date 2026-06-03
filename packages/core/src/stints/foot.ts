import type { Game, PlayerStint, TimelineEvent } from "../domain.js";
import { fillTimelineScores } from "./basket.js";

export type FootSubPair = {
  event: TimelineEvent;
  playerOut: string;
  playerIn: string;
};

function isSubEvent(event: TimelineEvent): boolean {
  return event.type === "substitution" || event.type === "sub";
}

/** Expand multi-replacement events into out/in pairs (actorIds: out, in, out, in…). */
export function expandFootSubstitutions(timeline: TimelineEvent[]): FootSubPair[] {
  const pairs: FootSubPair[] = [];
  for (const event of timeline) {
    if (!isSubEvent(event)) continue;
    const ids = event.actorIds;
    if (ids.length >= 2) {
      for (let i = 0; i + 1 < ids.length; i += 2) {
        const playerOut = ids[i];
        const playerIn = ids[i + 1];
        if (playerOut && playerIn) {
          pairs.push({ event, playerOut, playerIn });
        }
      }
      continue;
    }
    const meta = event.metadata ?? {};
    const playerIn =
      typeof meta.playerIn === "string" ? meta.playerIn : ids[0] ?? null;
    const playerOut =
      typeof meta.playerOut === "string" ? meta.playerOut : null;
    if (playerIn && playerOut) {
      pairs.push({ event, playerOut, playerIn });
    }
  }
  return pairs;
}

function teamDiff(
  game: Game,
  teamId: string,
  homeScore: number,
  awayScore: number
): number {
  return teamId === game.homeTeam.id
    ? homeScore - awayScore
    : awayScore - homeScore;
}

function stintLabel(event: TimelineEvent, startClock: string, endClock: string): string {
  const half = event.periodLabel || (event.period === 1 ? "1st Half" : "2nd Half");
  return `${half} ${startClock} → ${endClock}`;
}

/**
 * Build on-pitch segments for one player from substitution pairs + match score.
 */
export function buildFootPlayerStints(
  game: Game,
  rawTimeline: TimelineEvent[],
  entityId: string,
  teamId: string
): PlayerStint[] {
  const timeline = fillTimelineScores(
    [...rawTimeline].sort((a, b) => a.order - b.order)
  );
  if (timeline.length === 0) return [];

  const teamSubs = expandFootSubstitutions(timeline).filter(
    (p) => p.event.teamId === teamId
  );

  const firstIn = teamSubs.find((s) => s.playerIn === entityId);
  const firstOut = teamSubs.find((s) => s.playerOut === entityId);
  const isStarter =
    !firstIn ||
    (firstOut != null &&
      (firstOut.event.order < firstIn.event.order ||
        (firstOut.event.order === firstIn.event.order &&
          teamSubs.indexOf(firstOut) < teamSubs.indexOf(firstIn))));

  const stints: PlayerStint[] = [];
  let open: TimelineEvent | null = null;

  const closeStint = (end: TimelineEvent) => {
    if (!open) return;
    const startDiff = teamDiff(game, teamId, open.homeScore, open.awayScore);
    const endDiff = teamDiff(game, teamId, end.homeScore, end.awayScore);
    stints.push({
      stintIndex: stints.length + 1,
      period: open.period,
      periodLabel: open.periodLabel,
      startClock: open.clock,
      endClock: end.clock,
      startOrder: open.order,
      endOrder: end.order,
      scoreStart: { home: open.homeScore, away: open.awayScore },
      scoreEnd: { home: end.homeScore, away: end.awayScore },
      differential: endDiff - startDiff,
      label: stintLabel(open, open.clock, end.clock),
    });
    open = null;
  };

  if (isStarter) {
    open = timeline[0]!;
  }

  for (const event of timeline) {
    if (!isSubEvent(event) || event.teamId !== teamId) continue;
    const pairs = expandFootSubstitutions([event]);
    for (const { playerOut, playerIn } of pairs) {
      if (playerOut === entityId && open) {
        closeStint(event);
      }
      if (playerIn === entityId && !open) {
        open = event;
      }
    }
  }

  if (open) {
    const last =
      [...timeline].reverse().find((e) => e.type !== "halftime") ??
      timeline[timeline.length - 1];
    if (last) closeStint(last);
  }

  return stints;
}

export function summarizeFootPlayerStints(
  _game: Game,
  stints: PlayerStint[],
  entityName: string,
  teamAbbrev: string
): string {
  if (stints.length === 0) {
    return `${entityName}: no on-pitch segments parsed from substitutions.`;
  }
  const total = stints.reduce((sum, s) => sum + s.differential, 0);
  const lines = stints.map(
    (s) =>
      `Segment ${s.stintIndex} · ${s.label} · ${teamAbbrev} ${s.differential >= 0 ? "+" : ""}${s.differential} goals (score ${s.scoreStart.away}-${s.scoreStart.home} → ${s.scoreEnd.away}-${s.scoreEnd.home})`
  );
  return [
    `${entityName} on-pitch timeline (${stints.length} segment${stints.length > 1 ? "s" : ""}):`,
    ...lines,
    `Total on-pitch goal differential: ${total >= 0 ? "+" : ""}${total}`,
  ].join("\n");
}
