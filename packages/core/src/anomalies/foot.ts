import type {
  BoxLine,
  ContextBlock,
  Game,
  TimelineEvent,
} from "../domain.js";

function truncateGoalLabel(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const slice = text.slice(0, text.lastIndexOf(" ", maxLen) || maxLen);
  return slice.replace(/[,;:—–-]\s*$/, "") + "…";
}

export function detectGoalSequences(
  game: Game,
  timeline: TimelineEvent[]
): ContextBlock[] {
  const blocks: ContextBlock[] = [];
  const goals = timeline.filter((e) => e.type === "goal");

  for (let i = 0; i < goals.length; i++) {
    const g = goals[i]!;
    const window = timeline.filter(
      (e) => e.order >= g.order - 5 && e.order <= g.order + 3
    );
    const rawDesc = g.description.replace(/^GOAL [A-Z]+ — /i, "").replace(/^GOAL — /i, "");
    const truncated = truncateGoalLabel(rawDesc, 48);
    blocks.push({
      id: `${game.id}:goal:${g.order}`,
      gameId: game.id,
      sport: "foot",
      kind: "goal_sequence",
      label: `Goal — ${truncated}`,
      summaryText: `Goal at ${g.clock} (${g.periodLabel}). Score ${g.homeScore}-${g.awayScore}.\nContext:\n${window
        .map((e) => `[${e.clock}] ${e.description}`)
        .join("\n")}`,
      entityIds: g.actorIds,
      period: g.period,
      payload: { scorer: g.actorIds[0], score: [g.homeScore, g.awayScore] },
    });
  }

  return blocks;
}

export function detectDominationPeriods(
  game: Game,
  timeline: TimelineEvent[]
): ContextBlock[] {
  const blocks: ContextBlock[] = [];
  const byPeriod = new Map<number, TimelineEvent[]>();

  for (const e of timeline) {
    const list = byPeriod.get(e.period) ?? [];
    list.push(e);
    byPeriod.set(e.period, list);
  }

  for (const [period, events] of byPeriod) {
    const homeEv = events.filter((e) => e.teamId === game.homeTeam.id).length;
    const awayEv = events.filter((e) => e.teamId === game.awayTeam.id).length;
    const total = homeEv + awayEv;
    if (total < 5) continue;

    const dominant =
      homeEv > awayEv * 1.8
        ? game.homeTeam
        : awayEv > homeEv * 1.8
          ? game.awayTeam
          : null;

    if (!dominant) continue;

    blocks.push({
      id: `${game.id}:domination:${period}`,
      gameId: game.id,
      sport: "foot",
      kind: "domination_period",
      label: `${dominant.name} dominated — ${period === 1 ? "1st" : period === 2 ? "2nd" : `${period}th`} half`,
      summaryText: `${dominant.name} controlled the period (${homeEv} actions ${game.homeTeam.abbreviation} vs ${awayEv} ${game.awayTeam.abbreviation}).\n${events
        .slice(0, 8)
        .map((e) => `[${e.clock}] ${e.description}`)
        .join("\n")}`,
      entityIds: [],
      period,
      payload: { dominantTeamId: dominant.id, homeEv, awayEv },
    });
  }

  return blocks;
}

export function detectCardsPeriods(
  game: Game,
  timeline: TimelineEvent[]
): ContextBlock[] {
  const cards = timeline.filter(
    (e) => e.type === "card" || e.description.toLowerCase().includes("card")
  );
  if (cards.length === 0) return [];

  return [
    {
      id: `${game.id}:cards`,
      gameId: game.id,
      sport: "foot",
      kind: "cards_period",
      label: `${cards.length} cards in the match`,
      summaryText: cards
        .map((c) => `[${c.clock} ${c.periodLabel}] ${c.description}`)
        .join("\n"),
      entityIds: cards.flatMap((c) => c.actorIds),
      payload: { count: cards.length },
    },
  ];
}

export function detectFootPlayerSlices(
  game: Game,
  boxLines: BoxLine[]
): ContextBlock[] {
  return boxLines
    .filter((l) => Number(l.stats.goals ?? 0) > 0 || Number(l.stats.xg ?? 0) >= 0.3)
    .map((line) => ({
      id: `${game.id}:player:${line.entityId}`,
      gameId: game.id,
      sport: "foot" as const,
      kind: "player_slice" as const,
      label: `${line.entityName}: ${line.stats.goals ?? 0} goal(s)`,
      summaryText: `${line.entityName} — ${line.stats.goals ?? 0} goals, ${line.stats.assists ?? 0} assists, xG ${line.stats.xg ?? 0}, rating ${line.stats.rating ?? "—"}.`,
      entityIds: [line.entityId],
      payload: { ...line.stats },
    }));
}

export function computeFootContextBlocks(
  game: Game,
  boxLines: BoxLine[],
  timeline: TimelineEvent[]
): ContextBlock[] {
  return [
    ...detectGoalSequences(game, timeline),
    ...detectDominationPeriods(game, timeline),
    ...detectCardsPeriods(game, timeline),
    ...detectFootPlayerSlices(game, boxLines),
  ];
}

export function resolveFootStatContext(
  gameId: string,
  blocks: ContextBlock[],
  entityId: string,
  entityName: string,
  statKey: string
): { contextBlockIds: string[]; suggestedPrompt: string } {
  const playerBlock = blocks.find(
    (b) => b.kind === "player_slice" && b.entityIds.includes(entityId)
  );
  const goalBlocks = blocks.filter(
    (b) => b.kind === "goal_sequence" && b.entityIds.includes(entityId)
  );
  const cardBlocks = blocks.filter(
    (b) =>
      b.kind === "cards_period" &&
      (statKey === "fouls" ||
        statKey === "yellowCards" ||
        b.entityIds.includes(entityId))
  );
  const ids = [
    ...(playerBlock ? [playerBlock.id] : []),
    ...goalBlocks.map((b) => b.id),
    ...cardBlocks.map((b) => b.id),
  ];
  if (ids.length === 0) ids.push(`${gameId}:player:${entityId}`);

  const prompts: Record<string, string> = {
    goals: `Break down ${entityName}'s goals and chances.`,
    xg: `Does ${entityName}'s xG reflect their true performance?`,
    assists: `How did ${entityName} create for the team?`,
    rating: `Why is ${entityName}'s rating what it is?`,
    shots: `How was ${entityName}'s shot quality tonight?`,
    shotsOn: `How clinical was ${entityName} with shots on target?`,
    passes: `How involved was ${entityName} in build-up and distribution?`,
    fouls: `When did ${entityName} pick up fouls and how did that change the game?`,
    yellowCards: `Why did ${entityName} get booked and what was the impact?`,
    minutes: `How was ${entityName}'s workload distributed across the match?`,
  };

  return {
    contextBlockIds: [...new Set(ids)],
    suggestedPrompt:
      prompts[statKey] ??
      `Break down ${entityName}'s ${statKey} stat.`,
  };
}

export function buildFootMomentum(
  _game: Game,
  timeline: TimelineEvent[]
): import("../domain.js").MomentumPoint[] {
  const events = timeline.filter((e) => e.type === "goal" || e.homeScore + e.awayScore > 0);
  return events.map((e) => ({
    order: e.order,
    clock: e.clock,
    period: e.period,
    homeScore: e.homeScore,
    awayScore: e.awayScore,
    value: e.homeScore - e.awayScore,
    description: e.description,
  }));
}
