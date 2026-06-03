import type {
  ContextBlock,
  Game,
  InsightBundle,
  MomentumPoint,
  PlayerStint,
  Sport,
  Tone,
  SuggestedPrompt,
  StatClickContext,
  TimelineEvent,
  VerifiedFact,
} from "@after-the-whistle/core";
import {
  buildBasketMomentum,
  buildFootMomentum,
  buildInsightBundle,
  buildGamePlayerStints,
  formatFactForModel,
  FOOT_PERSONAS,
  PERSONAS,
  summarizeGamePlayerStints,
  toneInstruction,
  attachGameTeamIds,
} from "@after-the-whistle/core";
import { parseGameId, resolveBasketStatContext } from "@after-the-whistle/core";
import { GameRepository } from "@after-the-whistle/db";
import { getAdapterForGame } from "@after-the-whistle/providers";

export const repo = new GameRepository();

function formatContextBlocks(blocks: ContextBlock[]): string {
  if (blocks.length === 0) return "";
  return blocks.map((b) => `### ${b.label}\n${b.summaryText}`).join("\n\n");
}

export function buildContextText(blockIds: string[], gameId: string): string {
  const blocks = repo.getContextBlocks(gameId, blockIds);
  return formatContextBlocks(blocks);
}

export function getInsightBundle(gameId: string): InsightBundle | null {
  const game = repo.getGame(gameId);
  if (!game) return null;
  return buildInsightBundle(
    game,
    repo.getBoxLines(gameId),
    repo.getTimeline(gameId),
    repo.getContextBlocks(gameId),
  );
}

export function buildVerifiedContextText(
  gameId: string,
  blockIds: string[],
  entityId?: string,
): string {
  const insightBundle = getInsightBundle(gameId);
  const factLines =
    insightBundle?.facts
      .filter((fact) => {
        if (entityId && fact.entityIds.includes(entityId)) return true;
        return fact.evidence.some(
          (evidence) =>
            evidence.type === "context_block" && blockIds.includes(evidence.id),
        );
      })
      .slice(0, 8)
      .map(formatFactForModel) ?? [];

  const contextText = buildContextText(blockIds, gameId);
  const instruction = insightBundle?.modelInstruction ?? "";

  return [
    instruction ? `## Model rule\n${instruction}` : "",
    factLines.length ? `## Verified facts\n${factLines.join("\n")}` : "",
    contextText ? `## Context blocks\n${contextText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export type StatContextView = {
  contextText: string;
  click: StatClickContext;
  contextBlocks: ContextBlock[];
  timelinePlays: TimelineEvent[];
  relatedFacts: VerifiedFact[];
  uiHeadline: string;
  statValue: string | number | null;
  playerStints?: PlayerStint[];
  stintsSummary?: string;
};

function buildStatContextText(input: {
  instruction?: string;
  relatedFacts: VerifiedFact[];
  contextBlocks: ContextBlock[];
  stintsSummary?: string;
}): string {
  const factLines = input.relatedFacts.slice(0, 8).map(formatFactForModel);
  const contextText = formatContextBlocks(input.contextBlocks);

  return [
    input.instruction ? `## Model rule\n${input.instruction}` : "",
    factLines.length ? `## Verified facts\n${factLines.join("\n")}` : "",
    contextText ? `## Context blocks\n${contextText}` : "",
    input.stintsSummary ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function resolveMomentum(gameId: string): MomentumPoint[] {
  const cached = repo.getMomentum(gameId);
  if (cached.length > 0) return cached;

  const game = repo.getGame(gameId);
  const timeline = game
    ? attachGameTeamIds(repo.getTimeline(gameId), game)
    : repo.getTimeline(gameId);
  if (!game || timeline.length === 0) return [];

  return game.sport === "basket"
    ? buildBasketMomentum(timeline)
    : buildFootMomentum(game, timeline);
}

function summarizeBlockForUi(block: ContextBlock): string {
  const lines = block.summaryText.split("\n").filter(Boolean);
  return lines.slice(0, 4).join("\n");
}

function buildUiHeadline(
  entityName: string,
  statKey: string,
  statValue: string | number | null,
  blocks: ContextBlock[],
  facts: VerifiedFact[],
  tone: Tone,
): string {
  const pmFact = facts.find((f) => f.metric === "plus_minus");
  const runBlock = blocks.find((b) => b.kind === "scoring_run");

  if ((statKey === "min" || statKey === "minutes") && statValue != null) {
    if (tone === "bar") {
      return `${entityName} logged ${statValue} — when did the coach actually use them?`;
    }
    if (tone === "fan") {
      return `${entityName} played ${statValue} — were the minutes in the right spots?`;
    }
    if (tone === "pundit") {
      return `${entityName} at ${statValue} min — overrated or underrated tonight?`;
    }
    return `${entityName}: ${statValue} min — tie stints to runs and lineup context below.`;
  }

  if (statKey === "pf" && statValue != null) {
    if (tone === "bar") {
      return `${entityName} with ${statValue} fouls — did the refs or the matchups decide it?`;
    }
    if (tone === "pundit") {
      return `${entityName}, ${statValue} fouls — dirty play or bad whistle?`;
    }
    return `${entityName}: ${statValue} PF — foul trouble and whistle context below.`;
  }

  if (statKey === "plusMinus" && pmFact) {
    const v = pmFact.value;
    if (tone === "bar") {
      return runBlock
        ? `${entityName} (${v}) — shows up in ${runBlock.label.toLowerCase()}.`
        : `${entityName} (${v}) — his team owned the momentum swings.`;
    }
    if (tone === "fan") {
      return `${entityName} flipped the game at ${v} — the runs back it up.`;
    }
    if (tone === "pundit") {
      return `${entityName} at ${v} — does the box score tell the real story?`;
    }
    return `${entityName} ${v} — correlate with team runs and stint timing (verified).`;
  }

  if (tone === "bar") {
    return statValue != null
      ? `${entityName} · ${statShortLabel(statKey)} = ${statValue} — here’s when it happened.`
      : `${entityName} · ${statShortLabel(statKey)} — the thread below.`;
  }

  if (tone === "pundit") {
    return statValue != null
      ? `${entityName} · ${statShortLabel(statKey)} = ${statValue} — controversial read below.`
      : `${entityName} · ${statShortLabel(statKey)} — the take nobody wants to hear.`;
  }

  if (tone === "fan") {
    return statValue != null
      ? `${entityName} delivered ${statValue} ${statLongLabel(statKey)} — feel the momentum below.`
      : `${entityName} · ${statShortLabel(statKey)} — what the supporters saw.`;
  }

  return statValue != null
    ? `${entityName}: ${statShortLabel(statKey)} ${statValue} (verified context below)`
    : `${entityName}: ${statShortLabel(statKey)} breakdown`;
}

export function buildStatContextView(
  gameId: string,
  entityId: string,
  entityName: string,
  teamId: string,
  statKey: string,
  period?: number,
  tone: Tone = "analyst",
): StatContextView {
  const { click } = resolveStatContext(
    gameId,
    entityId,
    entityName,
    teamId,
    statKey,
    period,
  );

  const allBlocks = repo.getContextBlocks(gameId);
  const contextBlocks = allBlocks.filter((b) =>
    click.contextBlockIds.includes(b.id),
  );

  const game = repo.getGame(gameId);
  const timeline = game
    ? attachGameTeamIds(repo.getTimeline(gameId), game)
    : repo.getTimeline(gameId);
  const lastName = entityName.split(" ").pop() ?? entityName;
  const timelinePlays = timeline
    .filter((e) => {
      const lower = e.description.toLowerCase();

      if (statKey === "blk") {
        return lower.includes("block") && e.actorIds.includes(entityId);
      }
      if (statKey === "stl") {
        return lower.includes("steal") && e.actorIds.includes(entityId);
      }
      if (statKey === "tov") {
        return e.type === "turnover" && e.actorIds.includes(entityId);
      }
      if (statKey === "reb") {
        return e.type === "rebound" && e.actorIds.includes(entityId);
      }
      if (statKey === "ast") {
        return lower.includes("ast") && lower.includes(lastName.toLowerCase());
      }
      if (
        statKey === "pts" ||
        statKey === "fg" ||
        statKey === "fg3" ||
        statKey === "ft" ||
        statKey.includes("Pct")
      ) {
        return (
          (e.type === "made_shot" ||
            e.type === "missed_shot" ||
            e.type === "free_throw") &&
          e.actorIds.includes(entityId)
        );
      }

      if (
        statKey === "pf" &&
        e.type === "foul" &&
        e.actorIds.includes(entityId)
      ) {
        return true;
      }
      if (
        (statKey === "fouls" || statKey === "yellowCards") &&
        (e.type === "card" || e.type === "foul") &&
        e.actorIds.includes(entityId)
      ) {
        return true;
      }

      if (
        [
          "blk",
          "stl",
          "tov",
          "reb",
          "ast",
          "pts",
          "fg",
          "fg3",
          "ft",
          "fgPct",
          "fg3Pct",
          "ftPct",
          "pf",
        ].includes(statKey)
      ) {
        return false;
      }

      if (e.actorIds.includes(entityId)) return true;
      return contextBlocks.some(
        (b) =>
          b.kind === "scoring_run" &&
          typeof b.payload.startOrder === "number" &&
          typeof b.payload.endOrder === "number" &&
          e.order >= (b.payload.startOrder as number) &&
          e.order <= (b.payload.endOrder as number),
      );
    })
    .slice(-10);

  const line = repo.getBoxLines(gameId).find((l) => l.entityId === entityId);
  const statValue = line?.stats[statKey as keyof typeof line.stats] ?? null;

  const insightBundle = getInsightBundle(gameId);
  const statSpecificFact = buildClickedStatFact({
    gameId,
    sport: click.sport,
    entityId,
    entityName,
    teamId,
    statKey,
    statValue: statValue ?? null,
    timelinePlays,
  });
  const bundleFacts =
    insightBundle?.facts.filter(
      (f) =>
        f.entityIds.includes(entityId) ||
        (f.metric === "scoring_run" &&
          contextBlocks.some((b) => f.evidence.some((e) => e.id === b.id))),
    ) ?? [];
  const relatedFacts = dedupeFacts(
    [statSpecificFact, ...bundleFacts].filter((f): f is VerifiedFact =>
      Boolean(f),
    ),
  );

  let playerStints: PlayerStint[] | undefined;
  let stintsSummary: string | undefined;
  const footStintStats = new Set([
    "minutes",
    "goals",
    "assists",
    "rating",
    "xg",
    "shots",
    "shotsOn",
  ]);
  const basketStintStats = new Set(["min", "plusMinus", "tov"]);
  const includeStints =
    game &&
    ((game.sport === "basket" && basketStintStats.has(statKey)) ||
      (game.sport === "foot" && footStintStats.has(statKey)));

  if (includeStints) {
    playerStints = buildGamePlayerStints(game, timeline, entityId, teamId);
    const teamAbbrev =
      teamId === game.homeTeam.id
        ? game.homeTeam.abbreviation
        : game.awayTeam.abbreviation;
    stintsSummary = summarizeGamePlayerStints(
      game,
      playerStints,
      entityName,
      teamAbbrev,
    );
  }

  const uiHeadline = buildUiHeadline(
    entityName,
    statKey,
    statValue ?? null,
    contextBlocks,
    relatedFacts,
    tone,
  );

  const uiContextBlocks = contextBlocks.map((b) => ({
    ...b,
    label:
      b.kind === "player_slice" &&
      isStatFocusedKey(statKey) &&
      statValue != null
        ? `${entityName}: ${statValue} ${statShortLabel(statKey)}`
        : b.label,
    summaryText:
      b.kind === "player_slice" && isStatFocusedKey(statKey)
        ? summarizeClickedStatForUi(
            entityName,
            statKey,
            statValue ?? null,
            timelinePlays,
          )
        : summarizeBlockForUi(b),
  }));

  const contextText = buildStatContextText({
    instruction: insightBundle?.modelInstruction,
    relatedFacts,
    contextBlocks: uiContextBlocks,
    stintsSummary,
  });

  return {
    contextText,
    click,
    contextBlocks: uiContextBlocks,
    timelinePlays,
    relatedFacts: relatedFacts.slice(0, 6),
    uiHeadline,
    statValue: statValue ?? null,
    playerStints,
    stintsSummary,
  };
}

function buildClickedStatFact(input: {
  gameId: string;
  sport: Sport;
  entityId: string;
  entityName: string;
  teamId: string;
  statKey: string;
  statValue: string | number | null;
  timelinePlays: TimelineEvent[];
}): VerifiedFact | null {
  if (input.statValue == null) return null;
  if (!isStatFocusedKey(input.statKey)) return null;
  const label = `${input.entityName} ${statShortLabel(input.statKey)}`;
  const playCount = input.timelinePlays.length;
  return {
    id: `${input.gameId}:fact:clicked:${input.entityId}:${input.statKey}`,
    gameId: input.gameId,
    sport: input.sport,
    entityIds: [input.entityId],
    teamIds: [input.teamId],
    metric: input.statKey,
    value: input.statValue,
    label,
    explanation:
      playCount > 0
        ? `${input.entityName} finished with ${input.statValue} ${statLongLabel(input.statKey)}; ${playCount} matching play-by-play event(s) are listed below.`
        : `${input.entityName} finished with ${input.statValue} ${statLongLabel(input.statKey)}.`,
    evidence: [
      { type: "box_line", id: input.entityId, label: input.entityName },
    ],
  };
}

function dedupeFacts(facts: VerifiedFact[]): VerifiedFact[] {
  const seen = new Set<string>();
  const out: VerifiedFact[] = [];
  for (const fact of facts) {
    if (seen.has(fact.id)) continue;
    seen.add(fact.id);
    out.push(fact);
  }
  return out;
}

function isStatFocusedKey(statKey: string): boolean {
  return [
    "pts",
    "ast",
    "reb",
    "stl",
    "blk",
    "tov",
    "pf",
    "fg",
    "fg3",
    "ft",
    "goals",
    "assists",
    "shots",
    "shotsOn",
    "xg",
    "yellowCards",
    "fouls",
  ].includes(statKey);
}

function statShortLabel(statKey: string): string {
  const labels: Record<string, string> = {
    ast: "AST",
    reb: "REB",
    stl: "STL",
    blk: "BLK",
    tov: "TO",
    pf: "PF",
    fg: "FG",
    fg3: "3PT",
    ft: "FT",
    goals: "G",
    assists: "A",
    shots: "SH",
    shotsOn: "SOT",
    xg: "xG",
    yellowCards: "YC",
    fouls: "fouls",
  };
  return labels[statKey] ?? statKey.toUpperCase();
}

function statLongLabel(statKey: string): string {
  const labels: Record<string, string> = {
    ast: "assists",
    reb: "rebounds",
    stl: "steals",
    blk: "blocks",
    tov: "turnovers",
    pf: "personal fouls",
    fg: "field goals",
    fg3: "three-point field goals",
    ft: "free throws",
    shotsOn: "shots on target",
    yellowCards: "yellow cards",
  };
  return labels[statKey] ?? statShortLabel(statKey);
}

function summarizeClickedStatForUi(
  entityName: string,
  statKey: string,
  statValue: string | number | null,
  timelinePlays: TimelineEvent[],
): string {
  const head =
    statValue != null
      ? `${entityName} — ${statValue} ${statLongLabel(statKey)}.`
      : `${entityName} — ${statLongLabel(statKey)} context.`;
  const plays = timelinePlays
    .slice(-8)
    .map((p) => `[${p.clock} ${p.periodLabel}] ${p.description}`);
  if (plays.length === 0) return head;
  return `${head}\nRelevant plays:\n${plays.join("\n")}`;
}

export function resolveStatContext(
  gameId: string,
  entityId: string,
  entityName: string,
  teamId: string,
  statKey: string,
  period?: number,
): { contextText: string; click: StatClickContext } {
  const adapter = getAdapterForGame(gameId);
  const blocks = repo.getContextBlocks(gameId);
  const { sport } = parseGameId(gameId);
  const resolved =
    sport === "basket"
      ? resolveBasketStatContext(
          gameId,
          blocks,
          entityId,
          entityName,
          teamId,
          statKey,
        )
      : adapter.formatStatHandle(
          gameId,
          entityId,
          entityName,
          teamId,
          statKey as import("@after-the-whistle/core").StatKey,
        );

  const blockIds = resolved.contextBlockIds.filter((id) =>
    blocks.some((b) => b.id === id),
  );
  const fallbackIds = blockIds.length
    ? blockIds
    : blocks
        .filter((b) => b.entityIds.includes(entityId))
        .map((b) => b.id)
        .slice(0, 3);

  const click: StatClickContext = {
    gameId,
    sport,
    entityId,
    entityName,
    teamId,
    statKey: statKey as import("@after-the-whistle/core").StatKey,
    period,
    contextBlockIds: fallbackIds,
    suggestedPrompt: resolved.suggestedPrompt,
  };

  return {
    contextText: buildVerifiedContextText(gameId, fallbackIds, entityId),
    click,
  };
}

export function listSuggestedPrompts(gameId: string): SuggestedPrompt[] {
  const game = repo.getGame(gameId);
  if (!game) return [];

  const insightBundle = getInsightBundle(gameId);
  const blocks = repo.getContextBlocks(gameId);
  const prompts: SuggestedPrompt[] = [];

  const rankedInsights = [...(insightBundle?.insights ?? [])].sort(
    (a, b) =>
      scoreInsightPrompt(b.contextBlockIds, blocks, game) -
      scoreInsightPrompt(a.contextBlockIds, blocks, game),
  );

  for (const insight of rankedInsights.slice(0, 6)) {
    prompts.push({
      id: `prompt_${insight.id}`,
      label: insight.title,
      prompt: insight.suggestedPrompt,
      contextBlockIds: insight.contextBlockIds,
    });
  }

  const rankedBlocks = [...blocks].sort(
    (a, b) =>
      scoreContextBlockPrompt(b, game) - scoreContextBlockPrompt(a, game),
  );

  for (const b of rankedBlocks.slice(0, 6 - prompts.length)) {
    prompts.push({
      id: `prompt_${b.id}`,
      label: b.label,
      prompt: defaultPromptForBlock(b.kind, b.label, game.sport),
      contextBlockIds: [b.id],
    });
  }

  if (prompts.length === 0) {
    prompts.push({
      id: "prompt_general",
      label: "Full match breakdown",
      prompt: `Give a full After the Whistle breakdown of ${game.awayTeam.name} @ ${game.homeTeam.name} (${game.awayScore}-${game.homeScore}).`,
      contextBlockIds: [],
    });
  }

  return prompts;
}

function scoreInsightPrompt(
  contextBlockIds: string[],
  blocks: ContextBlock[],
  game: Game,
): number {
  if (contextBlockIds.length === 0) return 0;
  return Math.max(
    ...contextBlockIds.map((id) => {
      const block = blocks.find((b) => b.id === id);
      return block ? scoreContextBlockPrompt(block, game) : 0;
    }),
  );
}

function scoreContextBlockPrompt(block: ContextBlock, game: Game): number {
  let score = 0;
  if (block.kind === "scoring_run") {
    const runPoints = Number(block.payload.runPoints ?? 0);
    score += runPoints * 12;
    if ((block.period ?? 0) >= 4) score += 45;
    if ((block.period ?? 0) >= 5) score += 25;

    const startOrder = Number(block.payload.startOrder ?? 0);
    const endOrder = Number(block.payload.endOrder ?? 0);
    if (endOrder > startOrder)
      score += Math.min(20, (endOrder - startOrder) / 3);
  } else if (block.kind === "scoring_drought") {
    score += Number(block.payload.missCount ?? 0) * 8;
    if ((block.period ?? 0) >= 4) score += 28;
  } else if (
    block.kind === "goal_sequence" ||
    block.kind === "domination_period" ||
    block.kind === "xg_swing"
  ) {
    score += 80;
    if ((block.period ?? 0) >= 2) score += 15;
  } else if (block.kind === "player_slice") {
    score += 20;
  }

  const margin = Math.abs(game.homeScore - game.awayScore);
  if (margin <= 8) score += 15;
  if ((block.period ?? 0) >= 4 && margin <= 12) score += 20;
  return score;
}

function defaultPromptForBlock(
  kind: string,
  label: string,
  sport: string,
): string {
  if (kind === "scoring_run") {
    return `Break down this scoring run: ${label}. What triggered it tactically?`;
  }
  if (kind === "goal_sequence") {
    return `Walk through this goal sequence: ${label}.`;
  }
  if (kind === "domination_period") {
    return `Why did this team dominate this stretch: ${label}?`;
  }
  return sport === "basket"
    ? `Explain this key moment: ${label}`
    : `Analyze this episode: ${label}`;
}

export function personaMeta(tone: Tone = "analyst", sport?: Sport) {
  const cfg = sport === "foot" ? FOOT_PERSONAS[tone] : PERSONAS[tone];
  return {
    tone,
    personaLabel: cfg.label,
    systemHint: toneInstruction(tone, sport),
  };
}
