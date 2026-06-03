import type { Game, PlayerStint, TimelineEvent } from "../domain.js";

function periodLabel(period: number): string {
  if (period <= 4) return `Q${period}`;
  return `OT${period - 4}`;
}

/** Forward-fill score columns — NBA PBP only updates score on scoring events. */
export function fillTimelineScores(timeline: TimelineEvent[]): TimelineEvent[] {
  let home = 0;
  let away = 0;
  return timeline.map((e) => {
    if (e.homeScore > 0 || e.awayScore > 0) {
      home = e.homeScore;
      away = e.awayScore;
    }
    return { ...e, homeScore: home, awayScore: away };
  });
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

function subPlayers(event: TimelineEvent): { playerIn: string | null; playerOut: string | null } {
  const meta = event.metadata ?? {};
  const inId =
    typeof meta.playerIn === "string"
      ? meta.playerIn
      : event.actorIds[0] ?? null;
  const outId =
    typeof meta.playerOut === "string"
      ? meta.playerOut
      : typeof meta.player2 === "number" || typeof meta.player2 === "string"
        ? `player_${meta.player2}`
        : event.actorIds[1] ?? null;
  return { playerIn: inId, playerOut: outId };
}

function stintLabel(period: number, startClock: string, endClock: string): string {
  return `${periodLabel(period)} ${startClock} → ${endClock}`;
}

/**
 * Build on-floor stints for one player from substitution events + filled scores.
 */
export function buildPlayerStints(
  game: Game,
  rawTimeline: TimelineEvent[],
  entityId: string,
  teamId: string
): PlayerStint[] {
  const timeline = fillTimelineScores(
    [...rawTimeline].sort((a, b) => a.order - b.order)
  );
  const subs = timeline.filter((e) => e.type === "substitution");

  const firstIn = subs.find((s) => subPlayers(s).playerIn === entityId);
  const firstOut = subs.find((s) => subPlayers(s).playerOut === entityId);
  const onFloorBeforeFirstIn =
    firstIn != null &&
    timeline.some(
      (e) => e.order < firstIn.order && e.actorIds.includes(entityId)
    );
  const isStarter =
    !firstIn ||
    (firstOut != null && firstOut.order < firstIn.order) ||
    onFloorBeforeFirstIn;

  const stints: PlayerStint[] = [];
  let open: TimelineEvent | null = null;

  const closeStint = (end: TimelineEvent) => {
    if (!open) return;
    const startDiff = teamDiff(game, teamId, open.homeScore, open.awayScore);
    const endDiff = teamDiff(game, teamId, end.homeScore, end.awayScore);
    const differential = endDiff - startDiff;
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
      differential,
      label: stintLabel(open.period, open.clock, end.clock),
    });
    open = null;
  };

  if (isStarter && timeline.length > 0) {
    open = timeline[0]!;
  }

  for (const event of timeline) {
    if (event.type !== "substitution") continue;
    const { playerIn, playerOut } = subPlayers(event);

    if (playerOut === entityId && open) {
      closeStint(event);
    }
    if (playerIn === entityId && !open) {
      open = event;
    }
  }

  if (open) {
    const last = timeline[timeline.length - 1];
    if (last) closeStint(last);
  }

  return stints;
}

export function summarizePlayerStints(
  _game: Game,
  stints: PlayerStint[],
  entityName: string,
  teamAbbrev: string
): string {
  if (stints.length === 0) {
    return `${entityName}: no substitution stints parsed from play-by-play.`;
  }
  const total = stints.reduce((sum, s) => sum + s.differential, 0);
  const lines = stints.map(
    (s) =>
      `Stint ${s.stintIndex} · ${s.label} · ${teamAbbrev} ${s.differential >= 0 ? "+" : ""}${s.differential} (score ${s.scoreStart.away}-${s.scoreStart.home} → ${s.scoreEnd.away}-${s.scoreEnd.home})`
  );
  return [
    `${entityName} on-floor timeline (${stints.length} stints):`,
    ...lines,
    `Total on-floor differential: ${total >= 0 ? "+" : ""}${total}`,
  ].join("\n");
}
