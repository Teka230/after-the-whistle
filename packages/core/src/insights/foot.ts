import type {
  BoxLine,
  ContextBlock,
  Game,
  Insight,
  InsightBundle,
  VerifiedFact,
} from "../domain.js";
import { STRUCTURED_REASONING_INSTRUCTION } from "./engine.js";

export function buildFootInsightBundle(
  game: Game,
  boxLines: BoxLine[],
  _timeline: unknown[],
  contextBlocks: ContextBlock[]
): InsightBundle {
  const facts = [
    ...buildFootPlayerFacts(game, boxLines),
    ...buildFootEventFacts(game, contextBlocks),
  ];
  const insights = [
    ...buildGoalInsights(game, contextBlocks, facts),
    ...buildFootPlayerInsights(game, boxLines, contextBlocks, facts),
  ].slice(0, 8);

  return {
    gameId: game.id,
    sport: "foot",
    facts,
    insights,
    modelInstruction: STRUCTURED_REASONING_INSTRUCTION,
  };
}

function buildFootPlayerFacts(game: Game, boxLines: BoxLine[]): VerifiedFact[] {
  return boxLines.slice(0, 10).map((line) => ({
    id: `${game.id}:fact:player:${line.entityId}:match-line`,
    gameId: game.id,
    sport: "foot" as const,
    entityIds: [line.entityId],
    teamIds: [line.teamId],
    metric: "player_match_line",
    value: `${line.stats.goals ?? 0} goals, ${line.stats.assists ?? 0} assists, xG ${line.stats.xg ?? 0}`,
    label: `${line.entityName} match line`,
    explanation: `${line.entityName}: ${line.stats.goals ?? 0} goals, ${line.stats.assists ?? 0} assists, ${line.stats.shots ?? 0} shots, estimated xG ${line.stats.xg ?? 0}, rating ${line.stats.rating ?? "—"}.`,
    evidence: [{ type: "box_line", id: line.entityId, label: line.entityName }],
  }));
}

function buildFootEventFacts(
  game: Game,
  contextBlocks: ContextBlock[]
): VerifiedFact[] {
  return contextBlocks
    .filter((b) =>
      ["goal_sequence", "domination_period", "cards_period"].includes(b.kind)
    )
    .map((block) => ({
      id: `${block.id}:fact`,
      gameId: game.id,
      sport: "foot" as const,
      entityIds: block.entityIds,
      teamIds:
        typeof block.payload.dominantTeamId === "string"
          ? [block.payload.dominantTeamId]
          : [],
      metric: block.kind,
      value: block.label,
      label: block.label,
      explanation: block.summaryText.split("\n")[0] ?? block.summaryText,
      evidence: [{ type: "context_block" as const, id: block.id, label: block.label }],
    }));
}

function buildGoalInsights(
  game: Game,
  contextBlocks: ContextBlock[],
  facts: VerifiedFact[]
): Insight[] {
  return contextBlocks
    .filter((b) => b.kind === "goal_sequence")
    .map((block) => {
      const fact = facts.find((f) => f.id === `${block.id}:fact`);
      return {
        id: `${block.id}:insight`,
        gameId: game.id,
        sport: "foot" as const,
        title: block.label,
        angle: "turning_point" as const,
        summary: block.summaryText,
        factIds: fact ? [fact.id] : [],
        contextBlockIds: [block.id],
        suggestedPrompt: `Explain this goal sequence (${block.label}) using the verified facts.`,
      };
    });
}

function buildFootPlayerInsights(
  game: Game,
  boxLines: BoxLine[],
  contextBlocks: ContextBlock[],
  facts: VerifiedFact[]
): Insight[] {
  const impactPlayers = boxLines
    .filter((line) => Number(line.stats.goals ?? 0) > 0 || Number(line.stats.xg ?? 0) >= 0.3)
    .slice(0, 5);

  return impactPlayers.map((line) => ({
    id: `${game.id}:insight:player:${line.entityId}`,
    gameId: game.id,
    sport: "foot" as const,
    title: `${line.entityName}: verified impact`,
    angle: "player_impact" as const,
    summary: `${line.entityName} is tied to their stat line and the detected event sequences.`,
    factIds: facts.filter((f) => f.entityIds.includes(line.entityId)).map((f) => f.id),
    contextBlockIds: contextBlocks
      .filter((b) => b.entityIds.includes(line.entityId))
      .map((b) => b.id),
    suggestedPrompt: `Explain ${line.entityName}'s impact using only the verified facts.`,
  }));
}
