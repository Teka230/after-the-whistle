import type {
  BoxLine,
  ContextBlock,
  Game,
  ScoringRunView,
  TimelineEvent,
} from "../domain.js";
import { fillTimelineScores } from "../stints/basket.js";

const RUN_MIN_POINTS = 4;
const RUN_MIN_PLAYS = 2;
const DROUGHT_MIN_MISSES = 6;

type ScoringSequenceScan = {
  runTeam: string;
  runPoints: number;
  startOrder: number;
  endOrder: number;
  period: number;
  startIndex: number;
  endIndex: number;
};

function periodFromClock(period: number): string {
  if (period <= 4) return `Q${period}`;
  return `OT${period - 4}`;
}

function scoringPlays(timeline: TimelineEvent[]): TimelineEvent[] {
  return timeline.filter(
    (e) =>
      e.type === "made_shot" ||
      e.type === "free_throw" ||
      (e.description.toLowerCase().includes("makes") &&
        !e.description.toLowerCase().includes("miss"))
  );
}

function scanScoringSequences(
  game: Game,
  timeline: TimelineEvent[]
): ScoringSequenceScan[] {
  const scores = timeline.filter((e) => e.homeScore + e.awayScore > 0);
  if (scores.length < 1) return [];

  const sequences: ScoringSequenceScan[] = [];
  let runStart = 0;
  let runTeam: string | null = null;
  let runPoints = 0;

  const flush = (endIndex: number) => {
    if (!runTeam || runPoints < 1) return;
    const end = scores[endIndex]!;
    const start = scores[runStart]!;
    sequences.push({
      runTeam,
      runPoints,
      startOrder: start.order,
      endOrder: end.order,
      period: end.period,
      startIndex: runStart,
      endIndex,
    });
  };

  for (let i = 1; i < scores.length; i++) {
    const prev = scores[i - 1]!;
    const curr = scores[i]!;
    const prevDiff = prev.homeScore - prev.awayScore;
    const currDiff = curr.homeScore - curr.awayScore;
    const swing = currDiff - prevDiff;
    const scoringTeam =
      swing > 0
        ? game.homeTeam.id
        : swing < 0
          ? game.awayTeam.id
          : null;

    if (scoringTeam && scoringTeam === runTeam) {
      runPoints += Math.abs(swing);
    } else if (scoringTeam) {
      flush(i - 1);
      runStart = i - 1;
      runTeam = scoringTeam;
      runPoints = Math.abs(swing);
    }
  }

  flush(scores.length - 1);
  return sequences;
}

function teamForId(game: Game, teamId: string) {
  if (teamId === game.homeTeam.id) return game.homeTeam;
  if (teamId === game.awayTeam.id) return game.awayTeam;
  return null;
}

function sequenceToRunView(
  game: Game,
  seq: ScoringSequenceScan,
  id: string
): ScoringRunView {
  const team = teamForId(game, seq.runTeam);
  return {
    id,
    teamId: seq.runTeam,
    teamAbbrev: team?.abbreviation ?? "—",
    runPoints: seq.runPoints,
    period: seq.period,
    periodLabel: periodLabelFromNumber(seq.period),
    label: `Run ${seq.runPoints}-0 (${periodLabelFromNumber(seq.period)})`,
    startOrder: seq.startOrder,
    endOrder: seq.endOrder,
  };
}

/** Every consecutive scoring stretch (≥1 pt) for timeline viz. */
export function extractScoringSequencesFromTimeline(
  game: Game,
  timeline: TimelineEvent[]
): ScoringRunView[] {
  return scanScoringSequences(game, timeline).map((seq, idx) =>
    sequenceToRunView(game, seq, `${game.id}:seq:${idx}:${seq.startOrder}`)
  );
}

export function detectBasketRuns(
  game: Game,
  timeline: TimelineEvent[]
): ContextBlock[] {
  const scores = timeline.filter((e) => e.homeScore + e.awayScore > 0);
  if (scores.length < 1) return [];

  return scanScoringSequences(game, timeline)
    .filter(
      (seq) =>
        seq.runPoints >= RUN_MIN_POINTS &&
        seq.endIndex - seq.startIndex + 1 >= RUN_MIN_PLAYS
    )
    .map((seq) => {
      const end = scores[seq.endIndex]!;
      const plays = scores.slice(seq.startIndex, seq.endIndex + 1);
      return {
        id: `${game.id}:run:${seq.startIndex}`,
        gameId: game.id,
        sport: "basket" as const,
        kind: "scoring_run" as const,
        label: `Run ${seq.runPoints}-0 (${periodFromClock(end.period)})`,
        summaryText: buildRunSummary(game, seq.runTeam, seq.runPoints, plays),
        entityIds: [],
        period: end.period,
        payload: {
          runTeam: seq.runTeam,
          runPoints: seq.runPoints,
          startOrder: seq.startOrder,
          endOrder: seq.endOrder,
        },
      };
    });
}

function periodLabelFromNumber(period: number): string {
  if (period <= 4) return `Q${period}`;
  return `OT${period - 4}`;
}

/** Map stored context blocks to widget-ready scoring runs. */
export function extractScoringRuns(
  game: Game,
  blocks: ContextBlock[]
): ScoringRunView[] {
  return blocks
    .filter((b) => b.kind === "scoring_run")
    .map((block) => {
      const runTeam = String(block.payload.runTeam ?? "");
      const team =
        runTeam === game.homeTeam.id
          ? game.homeTeam
          : runTeam === game.awayTeam.id
            ? game.awayTeam
            : null;
      const period = block.period ?? Number(block.payload.period ?? 1);
      return {
        id: block.id,
        teamId: runTeam,
        teamAbbrev: team?.abbreviation ?? "—",
        runPoints: Number(block.payload.runPoints ?? 0),
        period,
        periodLabel: periodLabelFromNumber(period),
        label: block.label,
        startOrder: Number(block.payload.startOrder ?? 0),
        endOrder: Number(block.payload.endOrder ?? 0),
      };
    })
    .sort((a, b) => a.startOrder - b.startOrder);
}

function buildRunSummary(
  game: Game,
  teamId: string,
  points: number,
  plays: TimelineEvent[]
): string {
  const team =
    teamId === game.homeTeam.id ? game.homeTeam.name : game.awayTeam.name;
  const lines = plays
    .slice(-6)
    .map((p) => `[${p.clock} ${p.periodLabel}] ${p.description} (${p.awayScore}-${p.homeScore})`);
  return `Offensive run ${team}: +${points} pts.\n${lines.join("\n")}`;
}

export function detectBasketDroughts(
  game: Game,
  timeline: TimelineEvent[]
): ContextBlock[] {
  const blocks: ContextBlock[] = [];
  const misses = timeline.filter(
    (e) =>
      e.type === "missed_shot" ||
      e.description.toLowerCase().includes("miss")
  );

  if (misses.length < DROUGHT_MIN_MISSES) return blocks;

  let streak = 0;
  let streakTeam: string | null = null;
  let streakStart = 0;

  for (let i = 0; i < misses.length; i++) {
    const m = misses[i]!;
    const team = m.teamId;
    if (team === streakTeam) {
      streak++;
    } else {
      if (streakTeam && streak >= DROUGHT_MIN_MISSES) {
        blocks.push(makeDroughtBlock(game, streakTeam, streak, misses.slice(streakStart, i)));
      }
      streakTeam = team;
      streak = 1;
      streakStart = i;
    }
  }
  if (streakTeam && streak >= DROUGHT_MIN_MISSES) {
    blocks.push(makeDroughtBlock(game, streakTeam, streak, misses.slice(streakStart)));
  }

  return blocks;
}

function makeDroughtBlock(
  game: Game,
  teamId: string,
  count: number,
  plays: TimelineEvent[]
): ContextBlock {
  const team =
    teamId === game.homeTeam.id ? game.homeTeam.name : game.awayTeam.name;
  const last = plays[plays.length - 1]!;
  return {
    id: `${game.id}:drought:${teamId}:${last.order}`,
    gameId: game.id,
    sport: "basket",
    kind: "scoring_drought",
      label: `${team}: ${count} missed shots`,
      summaryText: `Tough offensive stretch for ${team}: ${count} consecutive missed shots.\n${plays
      .slice(-4)
      .map((p) => `[${p.clock}] ${p.description}`)
      .join("\n")}`,
    entityIds: [],
    period: last.period,
    payload: { teamId, missCount: count },
  };
}

export function detectPlayerSlices(
  game: Game,
  boxLines: BoxLine[],
  timeline: TimelineEvent[]
): ContextBlock[] {
  const blocks: ContextBlock[] = [];

  for (const line of boxLines) {
    const pts = Number(line.stats.pts ?? 0);
    const fga = parseFgAttempts(line.stats.fg as string | number | undefined);
    const plays = timeline.filter((e) => e.actorIds.includes(line.entityId));

    if (plays.length === 0 && pts === 0) continue;

    const q3Plays = plays.filter((p) => p.period === 3);
    const q4Plays = plays.filter((p) => p.period >= 4);
    const q3Makes = q3Plays.filter((p) => p.type === "made_shot").length;
    const q4Makes = q4Plays.filter((p) => p.type === "made_shot").length;

    let note = "";
    if (q3Makes > q4Makes + 2 && q4Plays.length > 2) {
      note = `Less efficient late in the game (Q3: ${q3Makes} makes vs Q4: ${q4Makes}).`;
    }

    blocks.push({
      id: `${game.id}:player:${line.entityId}`,
      gameId: game.id,
      sport: "basket",
      kind: "player_slice",
      label: `${line.entityName}: ${pts} pts`,
      summaryText: `${line.entityName} — ${pts} pts, ${line.stats.reb ?? 0} reb, ${line.stats.ast ?? 0} ast. FG: ${line.stats.fg ?? "—"}. ${note}\nKey moments:\n${plays
        .filter((p) => p.type === "made_shot" || p.type === "missed_shot")
        .slice(-8)
        .map((p) => `[${p.clock} ${p.periodLabel}] ${p.description}`)
        .join("\n")}`,
      entityIds: [line.entityId],
      payload: {
        pts,
        fga,
        q3Makes,
        q4Makes,
        fg: line.stats.fg,
        plusMinus: line.stats.plusMinus,
      },
    });
  }

  return blocks;
}

function parseFgAttempts(fg: string | number | undefined): number {
  if (typeof fg === "string" && fg.includes("-")) {
    const [made, att] = fg.split("-").map(Number);
    return att ?? made ?? 0;
  }
  return 0;
}

export function computeBasketContextBlocks(
  game: Game,
  boxLines: BoxLine[],
  timeline: TimelineEvent[]
): ContextBlock[] {
  return [
    ...detectBasketRuns(game, timeline),
    ...detectBasketDroughts(game, timeline),
    ...detectPlayerSlices(game, boxLines, timeline),
  ];
}

export function resolveBasketStatContext(
  gameId: string,
  blocks: ContextBlock[],
  entityId: string,
  entityName: string,
  teamId: string,
  statKey: string
): { contextBlockIds: string[]; suggestedPrompt: string } {
  const playerBlock = blocks.find(
    (b) => b.kind === "player_slice" && b.entityIds.includes(entityId)
  );
  const related = blocks.filter(
    (b) =>
      b.entityIds.includes(entityId) ||
      (playerBlock && b.id === playerBlock.id)
  );

  if (statKey === "plusMinus" || statKey === "min" || statKey === "pf") {
    const teamRuns = blocks
      .filter(
        (b) =>
          b.kind === "scoring_run" &&
          String(b.payload.runTeam ?? "") === teamId
      )
      .slice(0, 3);
    for (const run of teamRuns) {
      if (!related.some((b) => b.id === run.id)) related.push(run);
    }
  }

  const ids = related.length > 0 ? related.map((b) => b.id) : playerBlock ? [playerBlock.id] : [`${gameId}:player:${entityId}`];

  const prompts: Record<string, string> = {
    pts: `Why did ${entityName} score as much (or as little) tonight? Break down volume and efficiency.`,
    fg: `Analyze ${entityName}'s shot selection (zones, timing, defensive context).`,
    fg3: `How did ${entityName} shoot from three and what was the spacing impact?`,
    ft: `How did ${entityName} perform at the free-throw line and when did those trips happen?`,
    plusMinus: `Explain ${entityName}'s +/-: which lineups and runs line up with it?`,
    ast: `How did ${entityName} create for others late in possessions?`,
    reb: `Where and when did ${entityName} impact the glass?`,
    stl: `When did ${entityName} create disruption on defense?`,
    blk: `How did ${entityName} protect the rim and alter shots?`,
    tov: `When did ${entityName} give the ball away and what was the cost?`,
    pf: `How did ${entityName}'s foul trouble shape their minutes and the team's defense?`,
    min: `When was ${entityName} on the floor and how did their stints line up with momentum swings?`,
  };

  return {
    contextBlockIds: [...new Set(ids)],
    suggestedPrompt:
      prompts[statKey] ??
      `Break down ${entityName}'s ${statKey} stat using the play-by-play.`,
  };
}

export function buildBasketMomentum(timeline: TimelineEvent[]): import("../domain.js").MomentumPoint[] {
  const filled = fillTimelineScores(timeline);
  const scoring = scoringPlays(filled);
  return scoring.map((e) => ({
    order: e.order,
    clock: e.clock,
    period: e.period,
    homeScore: e.homeScore,
    awayScore: e.awayScore,
    value: e.homeScore - e.awayScore,
    description: e.description,
  }));
}
