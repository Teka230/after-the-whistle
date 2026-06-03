import type {
  BoxLine,
  ContextBlock,
  Game,
  Insight,
  InsightBundle,
  TimelineEvent,
  VerifiedFact,
} from "../domain.js";
import { STRUCTURED_REASONING_INSTRUCTION } from "./engine.js";

export function buildBasketInsightBundle(
  game: Game,
  boxLines: BoxLine[],
  _timeline: TimelineEvent[],
  contextBlocks: ContextBlock[],
): InsightBundle {
  const facts = [
    ...buildBasketPlayerFacts(game, boxLines),
    ...buildBasketRunFacts(game, contextBlocks),
    ...buildBasketDroughtFacts(game, contextBlocks),
  ];

  const insights = [
    ...buildTurningPointInsights(game, contextBlocks, facts, boxLines),
    ...buildPlayerImpactInsights(game, boxLines, contextBlocks, facts),
  ]
    .sort((a, b) => scoreBasketInsight(b, contextBlocks) - scoreBasketInsight(a, contextBlocks))
    .slice(0, 8);

  return {
    gameId: game.id,
    sport: "basket",
    facts,
    insights,
    modelInstruction: STRUCTURED_REASONING_INSTRUCTION,
  };
}

function scoreBasketInsight(insight: Insight, contextBlocks: ContextBlock[]): number {
  if (insight.angle === "player_impact") return 35;
  let score = 0;
  for (const id of insight.contextBlockIds) {
    const block = contextBlocks.find((b) => b.id === id);
    if (!block) continue;
    if (block.kind === "scoring_run") {
      score += Number(block.payload.runPoints ?? 0) * 12;
      if ((block.period ?? 0) >= 4) score += 45;
      if ((block.period ?? 0) >= 5) score += 25;
    }
    if (block.kind === "scoring_drought") {
      score += Number(block.payload.missCount ?? 0) * 8;
      if ((block.period ?? 0) >= 4) score += 28;
    }
  }
  return score;
}

function buildBasketPlayerFacts(
  game: Game,
  boxLines: BoxLine[],
): VerifiedFact[] {
  const facts: VerifiedFact[] = [];
  const sorted = [...boxLines].sort(
    (a, b) => Number(b.stats.pts ?? 0) - Number(a.stats.pts ?? 0),
  );

  for (const line of sorted.slice(0, 8)) {
    const pts = Number(line.stats.pts ?? 0);
    const reb = Number(line.stats.reb ?? 0);
    const ast = Number(line.stats.ast ?? 0);
    const plusMinus = Number(line.stats.plusMinus ?? 0);
    const fg = String(line.stats.fg ?? "—");
    const fg3 = String(line.stats.fg3 ?? "—");

    facts.push({
      id: `${game.id}:fact:player:${line.entityId}:production`,
      gameId: game.id,
      sport: "basket",
      entityIds: [line.entityId],
      teamIds: [line.teamId],
      metric: "player_production",
      value: `${pts} pts, ${reb} reb, ${ast} ast`,
      label: `${line.entityName} production`,
      explanation: `${line.entityName} finished with ${pts} points, ${reb} rebounds, ${ast} assists, ${fg} from the field and ${fg3} from three.`,
      evidence: [
        { type: "box_line", id: line.entityId, label: line.entityName },
      ],
    });

    if (Number.isFinite(plusMinus) && Math.abs(plusMinus) >= 8) {
      facts.push({
        id: `${game.id}:fact:player:${line.entityId}:plus-minus`,
        gameId: game.id,
        sport: "basket",
        entityIds: [line.entityId],
        teamIds: [line.teamId],
        metric: "plus_minus",
        value: plusMinus,
        label: `${line.entityName} +/-`,
        explanation: `${line.entityName} posted a notable plus/minus (${plusMinus > 0 ? "+" : ""}${plusMinus}); tie it to runs and lineups before drawing narrative conclusions.`,
        evidence: [
          { type: "box_line", id: line.entityId, label: "+/- box score" },
        ],
      });
    }
  }

  return facts;
}

function buildBasketRunFacts(
  game: Game,
  contextBlocks: ContextBlock[],
): VerifiedFact[] {
  return contextBlocks
    .filter((b) => b.kind === "scoring_run")
    .map((block) => {
      const runTeam = String(block.payload.runTeam ?? "");
      const team =
        runTeam === game.homeTeam.id
          ? game.homeTeam
          : runTeam === game.awayTeam.id
            ? game.awayTeam
            : undefined;
      return {
        id: `${block.id}:fact`,
        gameId: game.id,
        sport: "basket" as const,
        entityIds: [],
        teamIds: team ? [team.id] : [],
        metric: "scoring_run",
        value: Number(block.payload.runPoints ?? 0),
        label: block.label,
        explanation: block.summaryText.split("\n")[0] ?? block.summaryText,
        evidence: [
          { type: "context_block" as const, id: block.id, label: block.label },
        ],
      };
    });
}

function buildBasketDroughtFacts(
  game: Game,
  contextBlocks: ContextBlock[],
): VerifiedFact[] {
  return contextBlocks
    .filter((b) => b.kind === "scoring_drought")
    .map((block) => ({
      id: `${block.id}:fact`,
      gameId: game.id,
      sport: "basket" as const,
      entityIds: block.entityIds,
      teamIds: block.payload.teamId ? [String(block.payload.teamId)] : [],
      metric: "scoring_drought",
      value: Number(block.payload.missCount ?? 0),
      label: block.label,
      explanation: block.summaryText.split("\n")[0] ?? block.summaryText,
      evidence: [
        { type: "context_block" as const, id: block.id, label: block.label },
      ],
    }));
}

function buildTurningPointInsights(
  game: Game,
  contextBlocks: ContextBlock[],
  facts: VerifiedFact[],
  boxLines: BoxLine[],
): Insight[] {
  return contextBlocks
    .filter((b) => b.kind === "scoring_run")
    .map((block) => {
      const fact = facts.find((f) => f.id === `${block.id}:fact`);
      const runTeam = block.payload.runTeam as string;
      const opponentId =
        game.homeTeam.id === runTeam ? game.awayTeam.id : game.homeTeam.id;

      // Let's find the best player on the opponent team with the worst +/- to cross-reference
      let targetPlayer: BoxLine | undefined;
      const opponentPlayers = boxLines.filter((l) => l.teamId === opponentId);
      if (opponentPlayers.length > 0) {
        opponentPlayers.sort(
          (a, b) =>
            Number(a.stats.plusMinus ?? 0) - Number(b.stats.plusMinus ?? 0),
        );
        targetPlayer = opponentPlayers[0];
      }

      let suggestedPrompt = `Explain why ${block.label} shifted the game without recalculating any stats.`;

      if (targetPlayer && Number(targetPlayer.stats.plusMinus) <= -15) {
        suggestedPrompt = `Was ${targetPlayer.entityName} likely involved in the ${block.label}? Use box score and momentum context, but do not claim on-floor presence without stint data.`;
      }

      return {
        id: `${block.id}:insight`,
        gameId: game.id,
        sport: "basket" as const,
        title: block.label,
        angle: "turning_point" as const,
        summary: block.summaryText,
        factIds: fact ? [fact.id] : [],
        contextBlockIds: [block.id],
        suggestedPrompt,
      };
    });
}

function buildPlayerImpactInsights(
  game: Game,
  boxLines: BoxLine[],
  contextBlocks: ContextBlock[],
  facts: VerifiedFact[],
): Insight[] {
  const topPlayers = [...boxLines]
    .sort((a, b) => Number(b.stats.pts ?? 0) - Number(a.stats.pts ?? 0))
    .slice(0, 4);

  return topPlayers.map((line) => {
    const blocks = contextBlocks.filter((b) =>
      b.entityIds.includes(line.entityId),
    );
    const factIds = facts
      .filter((f) => f.entityIds.includes(line.entityId))
      .map((f) => f.id);

    return {
      id: `${game.id}:insight:player:${line.entityId}`,
      gameId: game.id,
      sport: "basket" as const,
      title: `${line.entityName}: verified impact`,
      angle: "player_impact" as const,
      summary: `${line.entityName} is the entry point to break down production, efficiency, +/- and related sequences.`,
      factIds,
      contextBlockIds: blocks.map((b) => b.id),
      suggestedPrompt: `Explain ${line.entityName}'s impact using only the verified facts.`,
    };
  });
}
