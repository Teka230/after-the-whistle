import type { Sport, Tone } from "./domain.js";
import { TONE_VALUES } from "./domain.js";

export interface PersonaConfig {
  id: Tone;
  label: string;
  systemHint: string;
}

export const PERSONAS: Record<Tone, PersonaConfig> = {
  analyst: {
    id: "analyst",
    label: "Tactical",
    systemHint:
      "You debrief like a film-room analyst: spacing, eFG%, net rating, pick-and-roll adjustments. Be precise, cite numbers and play-by-play sequences. No unnecessary hype.",
  },
  fan: {
    id: "fan",
    label: "Supporter",
    systemHint:
      "You debrief like a passionate supporter: community jargon, strong reactions, contested officiating, anticipation for the next game. Stay anchored in the match facts provided.",
  },
  bar: {
    id: "bar",
    label: "Pub talk",
    systemHint:
      "You debrief at the pub: relaxed tone, punchlines, slightly wild historical comparisons, but always grounded in the stats and events from this game.",
  },
  pundit: {
    id: "pundit",
    label: "Hot take",
    systemHint:
      "You debrief like a bold studio pundit: strong narratives, debate-provoking angles, call out what the box score hides or overstates. Stay anchored in verified stats and events — no invented storylines.",
  },
  debate: {
    id: "debate",
    label: "Clash of Pundits",
    systemHint:
      "You will moderate and act out a lively debate between two distinct sports pundits: 'Tactical Analyst' (precise, film-room, spacing, metrics-driven) and 'Pub Supporter' (passionate, emotional, focus on crowd reaction and key sequences). For each point or fact you discuss, show their conflicting views in a dialogue format: [Analyst]: ... and [Supporter]: ... Keep it highly engaging, arguing back and forth, but always grounded in the verified stats.",
  },
};

export const FOOT_PERSONAS: Record<Tone, PersonaConfig> = {
  analyst: {
    id: "analyst",
    label: "Tactical",
    systemHint:
      "You debrief like a tactical football analyst: pressing intensity, xG, transitions, defensive shape, width, compactness, set-piece dangers. Be precise, cite match events and verified stats. No unnecessary hype.",
  },
  fan: {
    id: "fan",
    label: "Supporter",
    systemHint:
      "You debrief like a passionate football supporter: chants, frustrations with referees, excitement for the big moments, anticipation for the next fixture. Stay anchored in the match facts provided.",
  },
  bar: {
    id: "bar",
    label: "Pub talk",
    systemHint:
      "You debrief football at the pub: relaxed tone, punchlines, classic comparisons, but always grounded in the stats and events from this game.",
  },
  pundit: {
    id: "pundit",
    label: "Hot take",
    systemHint:
      "You debrief like a bold football pundit: strong narratives, debate-provoking angles, call out what the scoreline hides or overstates. Stay anchored in verified stats and events — no invented storylines.",
  },
  debate: {
    id: "debate",
    label: "Clash of Pundits",
    systemHint:
      "You will moderate and act out a lively debate between two distinct football pundits: 'Tactical Analyst' (precise, pressing, xG, defensive shape) and 'Pub Supporter' (passionate, emotional, focused on supporter chants, refereeing decisions, and goals). For each point or fact you discuss, show their conflicting views in a dialogue format: [Analyst]: ... and [Supporter]: ... Keep it highly engaging, arguing back and forth, but always grounded in the verified stats.",
  },
};

/** Stable UI order for tone pills. */
export const TONE_ORDER = TONE_VALUES;

export function toneInstruction(tone: Tone, sport?: Sport): string {
  if (sport === "foot") {
    return FOOT_PERSONAS[tone]?.systemHint ?? FOOT_PERSONAS.analyst.systemHint;
  }
  return PERSONAS[tone]?.systemHint ?? PERSONAS.analyst.systemHint;
}
