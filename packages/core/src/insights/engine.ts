import type {
  BoxLine,
  ContextBlock,
  Game,
  InsightBundle,
  TimelineEvent,
  VerifiedFact,
} from "../domain.js";
import { buildBasketInsightBundle } from "./basket.js";
import { buildFootInsightBundle } from "./foot.js";

export function buildInsightBundle(
  game: Game,
  boxLines: BoxLine[],
  timeline: TimelineEvent[],
  contextBlocks: ContextBlock[]
): InsightBundle {
  if (game.sport === "basket") {
    return buildBasketInsightBundle(game, boxLines, timeline, contextBlocks);
  }
  return buildFootInsightBundle(game, boxLines, timeline, contextBlocks);
}

export function formatFactForModel(fact: VerifiedFact): string {
  const evidence = fact.evidence.map((e) => `${e.type}:${e.label}`).join(", ");
  return `- ${fact.label}: ${fact.value}. ${fact.explanation} [evidence: ${evidence}]`;
}

export const STRUCTURED_REASONING_INSTRUCTION =
  "The figures and takeaways below are computed by the deterministic engine. Do not recalculate them, contradict them, or invent new statistics that are not present. Your role is to explain, contextualize, and narrate in the selected tone.";
